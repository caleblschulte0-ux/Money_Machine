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

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from palette import light_hex, tone  # noqa: E402  -- the one place a colour comes from
from proportion import crown, shaft, stack  # noqa: E402  -- and the one place a SHAPE comes from
from ink import INK  # noqa: E402  -- and the one place an EDGE comes from
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

# The prop builders, the palette conversion and the primitives are all shared.
# This is a new way to COMPOSE the same world, not a second world.
import world_prop_pack as pack  # noqa: E402

OUT = ROOT / "art-review" / "world-scenes"
OUT.mkdir(parents=True, exist_ok=True)

# A portrait slice of the world, framed on the ground the dog stands on.
# 896x1792 is a 1:2 plate. The first was 768x1365, and wiring it exposed why
# the aspect is not a free choice: the app has to put the dog's feet on the
# painted ground, and the SMALLEST scale that does that while still covering
# the screen is driven by how much plate sits above the stand point. At 0.595
# the plate had to be blown up to 0.80 and cropped to the middle 63% of its
# width -- the framing bushes fell off both edges and the trees came out
# enormous. The stand point wants to sit near 0.77, which is roughly where the
# dog's feet sit on a phone (652 of 844), and then almost nothing is cropped.
# 768x1792 is a 3:7 plate, narrower than a phone.
#
# The scale the app can show a plate at is the LARGEST of four lower bounds,
# and at 896 wide the width bound (0.435) sat well under the height bound
# (0.514), so 18% of every plate was cropped away for nothing -- the beach's
# lifeguard tower and umbrella both fell half off the frame edges. Narrower,
# the height bound is the only one that binds and the horizontal crop is about
# one percent. The scene loses nothing: ortho_scale drops with the width so the
# vertical coverage is unchanged.
#
# Then ortho_scale went UP rather than down. Dropping it with the width kept
# the pixels-per-unit identical and simply showed less world, which came out
# as a zoomed-in park with enormous trees. With the crop gone the plate can
# afford a wider view instead, which is what it wanted all along.
RESOLUTION = (768, 1792)
CAMERA_LOCATION = (3.0, -10.8, 4.5)
# How far back the camera stands along its OWN axis. An orthographic camera's
# framing does not change when it dollies back -- only its clipping does -- and
# the first two renders came out with the bottom two fifths of the frame empty
# because the near ground fell behind the camera plane and was clipped away.
# Scaling the position keeps atan2(x, -y) identical, so the yaw every prop in
# the shared pack is built against is untouched.
# THE CAMERA'S ANGLE IS SET, NOT SOLVED FOR.
#
# It used to be positioned by scaling CAMERA_LOCATION outward and pointed with
# `look_at`, which couples two things that should be independent: how far back
# it stands (a clipping concern) and how steeply it looks down (a framing one).
# Every time a wider view needed the camera further back the pitch changed with
# it and the whole composition moved -- and three separate renders came out
# with a transparent strip along the bottom because the near ground had fallen
# behind the clip plane.
#
# Pitch and yaw are the prop pack's own, derived from the camera every prop is
# built against, so the plate and the props still agree about which way is up:
#   yaw   = atan2(3.0, 10.8)           = 15.57 degrees
#   pitch = atan(4.5 / hypot(3, 10.8)) = 21.88 degrees
# Distance is then only "far enough that nothing clips".
CAMERA_PITCH = math.atan(CAMERA_LOCATION[2] / math.hypot(CAMERA_LOCATION[0], CAMERA_LOCATION[1]))
CAMERA_DISTANCE = 220.0

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

# WHERE THINGS ARE, PUBLISHED RATHER THAN EYEBALLED.
#
# A plate is useless to the app unless the app knows where the dog's feet go,
# how big a metre is there, and where the horizon sits -- and those are facts
# about the render, not numbers to tune by hand until it looks right. Each
# builder records the world points it cares about here and `main` projects them
# through the actual camera, so the contract in the manifest cannot drift from
# the picture.
ANCHORS: dict = {}


def clean():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


NO_INK = None


def no_ink(obj):
    """Keep this form out of the Freestyle ink pass. See `setup()`."""
    if NO_INK is not None:
        NO_INK.objects.link(obj)
    return obj


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

    # THE INK EDGE, ON THE ONE LOCATION THAT IS NOT MADE OF PROPS.
    #
    # Every prop in the game gets a dark contour at PROMOTION, grown off its
    # own alpha (`scripts/promote-props.py`). A plate cannot: it is opaque
    # edge to edge, so there is no silhouette to dilate -- which would have
    # left the park as the one place in the world drawn without the line that
    # every other place has, and that is precisely the "these are two games"
    # read this whole pass is about.
    #
    # Freestyle draws it in the render instead, from the geometry. Same ink
    # (`ink.INK`, the one colour every edge in this game is), at a weight that
    # lands where a promoted prop's edge does once the plate is cover-scaled
    # onto a phone.
    #
    # The PROP pack draws its internal edges this way too now, with one
    # difference that is not a style choice: a prop is a turntable shot a fixed
    # distance from the camera, so its line is a constant; this scene runs
    # eighty units deep, so its line has to thin with distance or the treeline
    # fills in solid.
    scene.render.use_freestyle = True
    scene.render.line_thickness_mode = "ABSOLUTE"
    scene.render.line_thickness = 1.0
    view_layer = bpy.context.view_layer
    view_layer.use_freestyle = True
    settings = view_layer.freestyle_settings
    while settings.linesets:
        settings.linesets.remove(settings.linesets[0])
    # ...and it skips the grass. A blade is thinner than the line, so an ink
    # outline on a tuft fills it in solid: the first pass drew every tuft along
    # the path as a black clump. `no_ink()` is how a builder opts a form out.
    global NO_INK
    NO_INK = bpy.data.collections.new("Barkly no ink")
    scene.collection.children.link(NO_INK)

    lineset = settings.linesets.new("Barkly ink")
    lineset.select_by_collection = True
    lineset.collection = NO_INK
    lineset.collection_negation = "EXCLUSIVE"
    lineset.select_silhouette = True
    lineset.select_border = True
    lineset.select_crease = False       # interior creases turn a park into a sketch
    lineset.select_edge_mark = False
    lineset.select_contour = False
    lineset.linestyle.color = pack.rgb(INK)
    lineset.linestyle.thickness = 2.4
    # AND IT THINS WITH DISTANCE. A constant line is what a plate cannot
    # afford: this scene runs eighty units deep, so one weight puts the same
    # stroke on a bench four metres away and on a tuft of grass at the far
    # treeline, and the horizon fills in solid. The first attempt did exactly
    # that -- the treeline rendered as a band of ink with green holes in it.
    fade = lineset.linestyle.thickness_modifiers.new("depth", type="DISTANCE_FROM_CAMERA")
    fade.range_min, fade.range_max = 16.0, 80.0
    fade.value_min, fade.value_max = 2.4, 0.35
    fade.mapping = "LINEAR"

    # Ambient light stands in for the sky the app will draw behind this.
    scene.world.use_nodes = False
    scene.world.color = pack.rgb(ambient)

    bpy.ops.object.camera_add(location=(0.0, 0.0, 0.0))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    camera.data.sensor_fit = "HORIZONTAL"
    camera.data.clip_start = 0.1
    camera.data.clip_end = 600.0
    # The target is in the SCENE's frame too, or the camera aims off the axis
    # everything is built on: the first manifest put the dog's feet at x 0.461
    # and the horizon's centre at 0.418, which is a shot composed around a line
    # that is not the line the world was laid out on.
    # Aim by angle, then stand back along that aim. `target` is the point the
    # frame is CENTRED on, in the scene's own frame.
    aim = (*TURN(target[0], target[1]), target[2])
    camera.rotation_euler = (math.pi / 2 - CAMERA_PITCH, 0.0, THETA)
    forward = (
        -math.sin(THETA) * math.cos(CAMERA_PITCH),
        math.cos(THETA) * math.cos(CAMERA_PITCH),
        -math.sin(CAMERA_PITCH),
    )
    camera.location = tuple(aim[i] - forward[i] * CAMERA_DISTANCE for i in range(3))
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
    pack.look_at(sun, aim)

    # A cool bounce from the sky side, weak, no shadows of its own.
    bpy.ops.object.light_add(type="AREA", location=(5.0, -3.0, 5.0))
    fill = bpy.context.object
    fill.name = "Sky bounce"
    fill.data.energy = 220
    fill.data.size = 9.0
    fill.data.color = pack.rgb(light_hex("fill"))
    if hasattr(fill.data, "use_shadow"):
        fill.data.use_shadow = False
    pack.look_at(fill, aim)
    return camera


def ground(hex_near: str, hex_far: str = tone("grass", "lit"), centre: float = -48.5,
           size: float = 183.0, tooth: float = 26.0, bump: float = 0.10):
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
    # BOTH tones are the caller's. The first version hardcoded the park's
    # lighter green as the second stop, so the beach rendered green sand.
    plane.data.materials.append(
        noise_material("Ground", hex_near, hex_far, scale=1.5, tooth=tooth, bump=bump))
    return plane


def _anchor(name: str, x: float, y: float, z: float = 0.0):
    """Record a point in the camera's frame for the manifest to publish."""
    wx, wy = TURN(x, y)
    ANCHORS[name] = (wx, wy, z)


def park():
    """The park, composed.

    Positions are in world units on the ground plane, chosen so the middle of
    the frame stays clear -- that is where the dog stands, and he is drawn by
    the app on top of this.
    """
    ground(tone("grass", "base"))
    # Where the dog stands, how tall a world unit is there, and the horizon.
    _anchor("stand", 0.0, -3.0)
    _anchor("standTop", 0.0, -3.0, 1.0)
    _anchor("horizon", 0.0, 43.0)

    # The far treeline, as real trees at distance rather than a painted band.
    # A treeline far enough back to be a horizon, spread wider than the frame.
    for i in range(27):
        x = -34.0 + i * 2.6
        y = 37.5 + ((i * 0.618) % 1.0) * 3.0
        # SMALL. Wired into the app the first treeline came out as a wall of
        # trunks filling the top half of the phone: a tree of scale 2 is eight
        # units tall, and eight units at this camera is most of the frame. A
        # horizon is made of trees you read as far away, which means small.
        s = 1.05 + ((i * 0.382) % 1.0) * 0.45
        _tree(x, y, s, canopy=tone("foliage", "base"), trunk=tone("bark", "base"))

    # Then the trees that frame the shot: two near the edges, two mid-distance.
    for x, y, s in ((-7.6, -3.0, 1.6), (8.2, -1.4, 1.5), (-11.5, 11.0, 1.3), (12.5, 9.0, 1.25),
                    (-15.0, 22.0, 1.15), (16.0, 20.0, 1.1)):
        _tree(x, y, s)

    _path()

    # THE SHOT NEEDS FRAMING, and the first plate had none.
    #
    # Seen beside the other three locations the plated park was the WEAKEST of
    # the four, which is the opposite of what the plate was for. Town has
    # architecture and a sign to read, the beach has a tower and an umbrella,
    # home has the window. The park had a path and a repeating treeline: real
    # light on an empty field. The composited version it replaced had two big
    # trees holding the left and right edges, and losing them cost more than
    # the lighting gained.
    #
    # Near, large, and deliberately cropped by the frame -- they are the
    # proscenium, not scenery. Kept wide of x = +-5, where the app puts the DIG
    # mound and the two NPCs.
    # OUTSIDE the frame, not at its edge. The frame is x = +-9.25, and at
    # x = -8.6 a scale-3.2 tree put its whole canopy inside the shot: a green
    # mass across the middle of the picture where the dog stands, which frames
    # nothing. A proscenium is mostly off-stage -- trunks out of shot, only the
    # inner edge of each canopy reaching in.
    _tree(-12.2, -12.0, 3.0, canopy=tone("foliage", "shade"), trunk=tone("bark", "base"))
    _tree(12.6, -10.0, 2.9, canopy=tone("foliage", "base"), trunk=tone("bark", "lit"))

    # BACK, and off his head. At y 21 it sat directly behind the dog with its
    # roof at his ears, and a wide shallow cone that close reads as a parasol
    # rather than a building. Further away it is smaller, its posts and base
    # come into view, and the silhouette does the work.
    _bandstand(-2.6, 31.0, 1.5)
    _bench(5.0, -1.6)

    # Middle distance: hedges give the field a middle, which four trees and a
    # bench on open grass do not.
    _hedge(-12.0, 16.0, 10.0, 1.2)
    _hedge(13.5, 13.0, 9.0, 1.15)
    _hedge(-9.0, 28.0, 8.0, 1.0)
    _hedge(10.0, 30.0, 8.0, 0.95)

    # A PARK THAT IS ONLY GREEN IS A LAWN. Town carries coral, aqua and violet;
    # the beach carries a red umbrella and a yellow bucket. This had one yellow
    # flower repeated six times, which is not colour, it is a texture.
    beds = (
        (-4.8, 1.5, 1.2, tone("berry", "lit")), (5.2, 3.4, 1.1, tone("cream", "pop")),
        (-8.2, 6.0, 1.0, tone("sun", "lit")), (7.6, 6.8, 1.05, tone("grape", "lit")),
        (-2.0, 10.0, 0.9, tone("berry", "lit")), (3.4, 12.5, 0.85, tone("sun", "lit")),
        (-6.0, 16.0, 0.8, tone("cream", "pop")), (6.4, 18.0, 0.8, tone("grape", "lit")),
    )
    for fx, fy, fs, petal_hex in beds:
        _flowers(fx, fy, fs, petal_hex)

    # Scatter. Placed by a repeatable sequence, never at random, so a re-render
    # is the same park.
    for i in range(70):
        t = (i * 0.6180339887) % 1.0
        u = (i * 0.3819660113) % 1.0
        x = -15.0 + t * 30.0
        y = -22.0 + u * 74.0
        if abs(x) < 3.0 and y < 0.0:
            continue  # the dog stands here
        _tuft(x, y, 0.7 + u * 0.7)

    # The near edge of the frame. A scene with nothing in front of the subject
    # has no foreground, and the bottom of the shot is exactly where a diorama
    # wants one -- kept wide of centre so it never crowds the dog.
    # THE FRAME IS ONLY 17 UNITS WIDE. ortho_scale is the horizontal extent, so
    # anything past x = +-8.5 is off-camera -- the first foreground pass put
    # four bushes at +-11.5 and rendered none of them. Near corners sit just
    # inside the edge and are deliberately cropped by it.
    for bx, by, bs in ((-6.8, -11.0, 1.5), (7.2, -9.5, 1.45),
                       (-7.9, -18.0, 1.8), (7.8, -17.0, 1.75)):
        _bush(bx, by, bs)
    for fx, fy, fs in ((-4.4, -16.0, 1.9), (4.7, -15.0, 1.85),
                       (-6.6, -6.0, 1.5), (6.4, -5.0, 1.45)):
        _tuft(fx, fy, fs)


def noise_material(name: str, hex_a: str, hex_b: str, scale: float = 2.2,
                   detail: float = 4.0, tooth: float = 26.0, bump: float = 0.10):
    """Ground that varies CONTINUOUSLY, instead of in painted shapes.

    The first attempt laid irregular n-gons of slightly different green over
    the field. Zoomed in, every one of them showed a hard straight edge --
    because a polygon has hard straight edges -- so what should have read as
    terrain read as shapes cut out and placed on the grass. Lowering the
    contrast only made the shapes fainter; they were still shapes.

    A noise texture has no edges at all. Two greens through a colour ramp, at a
    scale that puts the variation somewhere between "a patch" and "a blade", so
    the ground takes the sun unevenly the way ground does.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 0.95
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = scale
    tex.inputs["Detail"].default_value = detail
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.34
    ramp.color_ramp.elements[0].color = (*pack.rgb(hex_a), 1.0)
    ramp.color_ramp.elements[1].position = 0.66
    ramp.color_ramp.elements[1].color = (*pack.rgb(hex_b), 1.0)
    nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])

    # AND A WHISPER OF TOOTH -- a whisper, and the amount is the point.
    #
    # The colour ramp above gives the ground broad patches, which is the
    # difference between "a fill" and "terrain". This adds the faintest break
    # in the plane itself so it is not one mathematically flat surface.
    #
    # It was five times this strong for one pass, and that was a mistake: at
    # that amount a field reads as FELT, and the game's character is clean and
    # cartoon, not plush. `tooth` is cycles per world unit (the plane is
    # created at its final size and never scaled, so its object coordinates
    # are world units); high and faint is a surface that is merely not flat,
    # low and strong is fabric.
    # OBJECT COORDINATES, and this is the whole difference between a textured
    # ground and a smooth one. A noise node with nothing plugged into Vector
    # falls back to GENERATED coordinates, which are normalised 0..1 across the
    # object's bounding box -- and this plane's bounding box is 183 units wide.
    # A scale of 9 then means nine cycles across the entire field, one cycle
    # per twenty metres, which renders as a faint gradient and reads as
    # nothing. The plane is created at its final size and never scaled, so its
    # object coordinates are world units and `tooth` means cycles per unit,
    # exactly as it does in the prop pack.
    #
    # The colour ramp above is deliberately LEFT on Generated: its scale was
    # tuned against the bounding box to give the field broad patches, and
    # moving it here would be retuning a thing that works.
    coord = nt.nodes.new("ShaderNodeTexCoord")
    grain = nt.nodes.new("ShaderNodeTexNoise")
    nt.links.new(coord.outputs["Object"], grain.inputs["Vector"])
    grain.inputs["Scale"].default_value = tooth
    grain.inputs["Detail"].default_value = 6.0
    spread = nt.nodes.new("ShaderNodeMapRange")
    spread.inputs["From Min"].default_value = 0.36
    spread.inputs["From Max"].default_value = 0.64
    spread.clamp = True
    nt.links.new(grain.outputs["Fac"], spread.inputs["Value"])
    relief = nt.nodes.new("ShaderNodeBump")
    relief.inputs["Strength"].default_value = bump
    relief.inputs["Distance"].default_value = 0.02
    nt.links.new(spread.outputs["Result"], relief.inputs["Height"])
    nt.links.new(relief.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def place(builder, x: float, y: float, s: float = 1.0, flip: bool = False):
    """Put one of the PROP PACK'S OWN builders into this scene.

    The beach spent several passes with scene-local rebuilds of props that
    already exist and already look better: `beach_lifeguard` has a ladder and a
    window, `beach_palm` has a crown, `beach_castle` has crenellations. My
    versions had a red box, three flat blades and three plain cylinders. There
    was never a reason to rebuild them -- they are built at the origin in world
    space, for THIS camera, so placing one is a translation and a scale.

    Everything the builder creates is parented to an empty and moved together,
    because scaling each object about its own origin scales the pieces and not
    the assembly.
    """
    before = set(bpy.data.objects)
    builder()
    made = [o for o in bpy.data.objects if o not in before]
    if not made:
        return None
    # DROP THE FAKE SHADOW. Every prop-pack builder lays a dark flattened
    # sphere under itself, because a prop rendered alone has no ground to cast
    # onto and needs something that says "this is touching". In here the ground
    # is real and the sun casts for itself, so that ellipse is a black hole
    # painted under the object -- visible as exactly that under the first
    # placed lifeguard tower and palm.
    for obj in list(made):
        if obj.name.startswith("contact_shadow"):
            made.remove(obj)
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.object.empty_add(location=(0.0, 0.0, 0.0))
    root = bpy.context.object
    root.name = f"placed_{x:.1f}_{y:.1f}"
    for obj in made:
        if obj.parent is None:
            obj.parent = root
    wx, wy = TURN(x, y)
    root.location = (wx, wy, 0.0)
    # No rotation: the props are already built for this camera's orientation.
    root.scale = (-s if flip else s, s, s)
    return root


def _band(name: str, y0: float, y1: float, z: float, mat, half_width: float = 70.0):
    """A depth band as an axis-aligned plane, ROTATED into the camera frame.

    `_poly` bakes the rotation into its vertices, which leaves the object's
    bounding box turned 15.6 degrees -- and `Generated` texture coordinates are
    taken from that box, so a gradient meant to run from shore to horizon ran
    diagonally across the water instead. Rotating the OBJECT keeps its local Y
    pointing straight into the distance, which is what the ramp needs.
    """
    cx, cy = TURN(0.0, (y0 + y1) / 2)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(cx, cy, z), rotation=(0, 0, THETA))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (half_width * 2, y1 - y0, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def depth_material(name: str, hex_near: str, hex_far: str, roughness: float = 0.90):
    """A surface that changes colour with DISTANCE, continuously.

    Same lesson the ground already taught, and I walked into it again: the
    first sea was three flat rectangles of different teal, which is three hard
    horizontal edges across the water. Shallows do not have an edge -- they get
    deeper.

    Generated coordinates run 0..1 across the object's own bounding box, so the
    ramp is anchored to the polygon rather than to a world position, and moving
    the sea moves its gradient with it.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = roughness
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*pack.rgb(hex_near), 1.0)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (*pack.rgb(hex_far), 1.0)
    nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def _poly(name: str, points, z: float, mat):
    """One flat n-gon on the ground, from points already in the camera frame."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(*TURN(x, y), z) for x, y in points], [], [list(range(len(points)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def _hedge(x: float, y: float, length: float, s: float = 1.0):
    """A run of hedge, for the middle distance.

    Four trees and a bench on open grass gives a scene a back and a front and
    no middle. This is the middle.
    """
    body = pack.material(f"Hedge{x:.1f}", tone("foliage", "shade"), roughness=0.92)
    top = pack.material(f"HedgeTop{x:.1f}", tone("foliage", "base"), roughness=0.90)
    n = max(3, int(length / 0.9))
    for i in range(n):
        hx = x - length / 2 + i * (length / (n - 1))
        wx, wy = TURN(hx, y + math.sin(i * 1.7) * 0.12)
        h = (0.95 + ((i * 0.618) % 1.0) * 0.35) * s
        pack.sphere(f"hedge{x:.1f}{i}", (wx, wy, h * 0.45), (0.72 * s, 0.62 * s, h * 0.5),
                    top if i % 3 == 0 else body)


def _bush(x: float, y: float, s: float = 1.0):
    """A shrub for the near corners. Foreground is mass, not detail."""
    dark = pack.material(f"Bush{x:.1f}{y:.1f}", tone("foliage", "shade"), roughness=0.92)
    lit = pack.material(f"BushLit{x:.1f}{y:.1f}", tone("foliage", "base"), roughness=0.90)
    for i, (dx, dy, dz, r) in enumerate((
        (0.0, 0.0, 0.55, 1.0), (-0.72, 0.18, 0.42, 0.78),
        (0.70, -0.12, 0.46, 0.82), (0.05, -0.35, 0.72, 0.66),
    )):
        wx, wy = TURN(x + dx * s, y + dy * s)
        pack.sphere(f"bush{x:.1f}{y:.1f}{i}", (wx, wy, dz * s),
                    (r * s, r * 0.85 * s, r * 0.78 * s), lit if i == 3 else dark)


def _flowers(x: float, y: float, s: float = 1.0, petal_hex: str = tone("sun", "lit")):
    petal = pack.material(f"Petal{x:.2f}{y:.2f}", petal_hex, roughness=0.80)
    stem = pack.material(f"Stem{x:.2f}{y:.2f}", tone("grass", "shade"), roughness=0.90)
    for i in range(7):
        a = i * 1.6 + x
        r = 0.20 + (i % 3) * 0.14
        fx, fy = TURN(x + math.cos(a) * r, y + math.sin(a) * r)
        h = (0.32 + ((i * 0.618) % 1.0) * 0.16) * s
        no_ink(pack.cylinder(f"stem{x:.2f}{y:.2f}{i}", (fx, fy, h / 2), 0.022 * s, h, stem, vertices=8))
        no_ink(pack.sphere(f"bud{x:.2f}{y:.2f}{i}", (fx, fy, h), (0.10 * s, 0.10 * s, 0.06 * s), petal))


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
    dirt = pack.material("Path", tone("paving", "base"), roughness=0.96)
    left, right = [], []
    for i in range(15):
        t = i / 14.0
        y = -40.0 + t * 81.0
        w = 2.2 - t * 1.95          # narrows with distance, because it does
        wobble = math.sin(t * 5.2) * 0.5
        left.append((wobble - w, y))
        right.append((wobble + w, y))
    _poly("path", left + right[::-1], 0.010, dirt)


def _bandstand(x: float, y: float, s: float = 1.0):
    """The park's landmark.

    Four scenes side by side and this was the only one without a subject.
    Town has a shopfront with its name on it, the beach has the lifeguard
    tower, home has the window -- the park had scenery and nothing to look at.
    Framing trees and flowerbeds made it a nicer field; they did not give it a
    thing you would walk toward.

    A bandstand is the right answer for a park specifically: it is
    ARCHITECTURE, which is what town has and the park lacked, and its
    silhouette -- a roof on posts, open underneath -- reads instantly at any
    size without needing detail. Centre-back, so the dog stands in front of it
    the way he stands in front of BARKLY'S.
    """
    post = pack.material(f"Band post{x:.1f}", tone("cream", "pop"), roughness=0.72)
    roof = pack.material(f"Band roof{x:.1f}", tone("roof", "base"), roughness=0.70)
    trim = pack.material(f"Band trim{x:.1f}", tone("sea", "base"), roughness=0.68)
    base = pack.material(f"Band base{x:.1f}", tone("sand", "lit"), roughness=0.88)
    finial = pack.material(f"Band finial{x:.1f}", tone("sun", "lit"), roughness=0.60)

    cx, cy = TURN(x, y)
    pack.cylinder(f"bandbase{x:.1f}", (cx, cy, 0.22 * s), 3.1 * s, 0.44 * s, base, vertices=24)
    pack.cylinder(f"bandstep{x:.1f}", (cx, cy, 0.06 * s), 3.5 * s, 0.12 * s, base, vertices=24)
    for i in range(6):
        a = i / 6.0 * math.tau + 0.26
        px, py = TURN(x + math.cos(a) * 2.5 * s, y + math.sin(a) * 2.5 * s)
        pack.cone(f"bandpost{x:.1f}{i}", (px, py, 1.78 * s), 0.28 * s, shaft(0.28 * s), 2.76 * s, post, vertices=12)
        pack.cylinder(f"bandfoot{x:.1f}{i}", (px, py, 0.52 * s), 0.40 * s, 0.30 * s, post, vertices=12, taper=0.78)
    pack.cylinder(f"bandring{x:.1f}", (cx, cy, 3.18 * s), 2.72 * s, 0.22 * s, trim, vertices=24)
    pack.cone(f"bandroof{x:.1f}", (cx, cy, 4.05 * s), 2.95 * s, 0.22 * s, 1.65 * s, roof, vertices=6)
    pack.sphere(f"bandfin{x:.1f}", (cx, cy, 5.05 * s), (0.20 * s, 0.20 * s, 0.28 * s), finial)
    # A railing between the posts, which is what stops it reading as a canopy
    # on sticks: a bandstand is enclosed at the bottom and open at the top.
    for i in range(6):
        a = i / 6.0 * math.tau + 0.26
        rx, ry = TURN(x + math.cos(a) * 2.5 * s, y + math.sin(a) * 2.5 * s)
        pack.cylinder(f"bandrail{x:.1f}{i}", (rx, ry, 1.08 * s), 0.19 * s, 0.44 * s, trim, vertices=10, taper=0.92)


def _tree(x: float, y: float, s: float, canopy: str = tone("foliage", "base"),
          trunk: str = tone("bark", "base")):
    bark = pack.material(f"Bark{x:.1f}{y:.1f}", trunk, roughness=0.92)
    leaf = pack.material(f"Leaf{x:.1f}{y:.1f}", canopy, roughness=0.88)
    leaf_hi = pack.material(f"LeafHi{x:.1f}{y:.1f}", tone("foliage", "lit"), roughness=0.86)
    # THE SAME TREE AS park/tree.png, at plate scale.
    #
    # The park is the one location drawn as a single composed plate, so it has
    # its own tree -- and a tree here that is proportioned differently from the
    # modular one is exactly the drift that makes a game look like two games.
    # Both now flare the same amount from the same dial and hang one canopy
    # mass over the shoulder instead of balancing lobes on top of it.
    wx, wy = TURN(x, y)
    base_r = 0.62 * s
    pack.cone(f"trunk{x:.1f}{y:.1f}", (wx, wy, 1.28 * s), base_r, shaft(base_r, 0.32), 2.56 * s, bark)
    crown_z = stack(2.56 * s, 1.16 * s)
    pack.sphere(f"leaf{x:.1f}{y:.1f}_mass", (wx, wy, crown_z),
                (crown(base_r), crown(base_r) * 0.94, 1.16 * s), leaf)
    for i, (dx, dy, dz, r) in enumerate((
        (-0.42, -0.30, 0.86, 0.96), (1.46, 0.18, 0.14, 0.80),
        (-1.52, 0.22, -0.28, 0.74),
    )):
        lx, ly = TURN(x + dx * s, y + dy * s)
        pack.sphere(f"leaf{x:.1f}{y:.1f}_{i}",
                    (lx, ly, crown_z + dz * s),
                    (r * s, r * 0.86 * s, r * 0.78 * s),
                    leaf_hi if i == 0 else leaf)


def _bench(x: float, y: float):
    wood = pack.material("Bench wood", tone("wood", "base"), roughness=0.72)
    iron = pack.material("Bench iron", tone("metal", "shade"), roughness=0.60, metallic=0.4)
    # Same argument as _tree: this is park/bench.png at plate scale, so it gets
    # the same plank-on-stubby-legs proportions. 0.055 of thickness on a slat
    # is a sheet of paper at this camera.
    sx_, sy_ = TURN(x, y - 0.06)
    pack.cube("bench seat", (sx_, sy_, 0.86), (1.58, 0.56, 0.17), wood, 0.15,
              rotation=(0, 0, THETA))
    for i, (dz, dy) in enumerate(((1.26, 0.34), (1.70, 0.34))):
        bx, by = TURN(x, y + dy)
        pack.cube(f"slat{i}", (bx, by, dz), (1.46, 0.19, 0.21), wood, 0.17,
                  rotation=(0, 0, THETA))
    for i, sx in enumerate((-1.22, 1.22)):
        lx, ly = TURN(x + sx, y + 0.16)
        pack.cube(f"leg{i}", (lx, ly, 0.36), (0.21, 0.27, 0.41), iron, 0.13,
                  rotation=(0, 0, THETA))


def _tuft(x: float, y: float, s: float):
    mats = (
        pack.material(f"Blade{x:.2f}{y:.2f}a", tone("grass", "base"), roughness=0.90),
        pack.material(f"Blade{x:.2f}{y:.2f}b", tone("grass", "lit"), roughness=0.90),
    )
    for i in range(5):
        a = (i / 5.0) * math.tau + x
        lean = 0.22 + ((i * 0.618) % 1.0) * 0.18
        h = (0.42 + ((i * 0.382) % 1.0) * 0.30) * s
        bx, by = TURN(x + math.cos(a) * 0.12, y + math.sin(a) * 0.12)
        blade = no_ink(pack.cone(f"bl{x:.2f}{y:.2f}{i}", (bx, by, h / 2),
                                 0.045 * s, 0.004, h, mats[i % 2],
                                 rotation=(math.cos(a) * lean, math.sin(a) * lean, 0), vertices=8))
        blade.scale = (1.0, 0.34, 1.0)



def beach():
    """The beach, composed.

    Two surfaces, not one: sand runs to the tide line and sea runs from there
    to the horizon. The app used to draw both as gradients with a wavy SVG
    stroke between them; here the shoreline is where two real planes meet, so
    the surf sits in a place rather than on a picture, and the umbrella throws
    its shadow across the sand it stands on.
    """
    ground(tone("sand", "base"), tone("sand", "lit"), tooth=38.0, bump=0.09)
    _anchor("stand", 0.0, -3.0)
    _anchor("standTop", 0.0, -3.0, 1.0)
    _anchor("horizon", 0.0, 43.0)

    # The sea: its own plane, starting at the tide line and running past the
    # sand's far edge so no seam of bare ground shows between them.
    # Wet sand: the strip the water has just left, darker and slightly damp.
    wet = pack.material("Wet sand", tone("sand", "base"), roughness=0.72, coat=0.18)
    _band("wet", 20.0, 25.3, 0.006, wet)

    # Shallows to deep water, as one continuous ramp.
    _band("sea", 25.0, 43.0, 0.005, depth_material("Sea", tone("sea", "base"), tone("sea", "shade")))

    _surf(25.0)
    _headland(40.0)

    # Dunes behind, so the sand has a back edge that is not the sea.
    # Dunes, kept inside the frame: x is only +-8.5 at this ortho scale.
    # PLACED BY WHERE THEY LAND ON SCREEN, not by eye. At this camera one
    # world unit is 0.55% of the frame, so the visible ground runs from about
    # y = -56 at the bottom edge to the horizon at y = 62. The first pass put
    # every prop between y = -16 and +6 -- a band from 0.66 to 0.74 of the
    # frame -- and left the whole bottom third as empty sand.
    for dx, dy, ds in ((-7.8, 16.0, 1.1), (7.6, 14.0, 1.05), (-6.4, 21.0, 0.85), (6.8, 22.0, 0.8)):
        place(pack.beach_dune, dx, dy, ds, flip=dx > 0)

    # AND NOT PAST THE CAMERA. The camera stands at y = -30 in this frame, so
    # a prop at y = -36 is behind its near plane and renders as nothing but the
    # shadow it casts -- which is exactly what the first palm did. Anything
    # nearer than about y = -26 is not foreground, it is gone.
    # THE APP PUTS THINGS HERE TOO. The dig/sift mound lands on the left of
    # the frame just below his shoulder and the NPCs stand either side of him,
    # so the plate has to leave that band clear -- the first wiring put the
    # lifeguard tower exactly where the SIFT mound goes and the two drew
    # through each other.
    place(pack.beach_lifeguard, -6.4, 13.0, 1.05)  # ~0.58 -- back and left
    place(pack.beach_umbrella, 6.2, -8.0, 1.15)    # ~0.74 -- beside him
    place(pack.beach_castle, 5.0, -16.0, 1.2)      # ~0.78 -- in front of him
    # NO PALM. Four passes at it: too small to read, then overlapping the
    # lifeguard tower, then a flat green mass across it. The prop is fine --
    # it is built to be seen alone at 142pt, where its crown reads from the
    # side; at this camera, at the size the near corner needs, it covers the
    # thing behind it. A scene does not owe every prop a place in it.
    place(pack.beach_dune, -7.4, -13.0, 1.3, flip=True)
    _towel(1.6, -3.0, 1.0)            # ~0.71 -- the middle, which was bare sand
    _bucket(-3.0, -11.0, 0.8)

    # Scatter: shells, pebbles and marram, thinning toward the water.
    for i in range(34):
        t = (i * 0.6180339887) % 1.0
        u = (i * 0.3819660113) % 1.0
        x = -13.0 + t * 26.0
        y = -26.0 + u * 56.0
        if abs(x) < 3.0 and y < 0.0:
            continue
        if i % 3 == 0:
            _pebble(x, y, 0.7 + u * 0.7)
        else:
            _marram(x, y, 0.8 + u * 0.6)


def _surf(y: float):
    """Foam where the two surfaces meet. It BREAKS, or it is a kerb."""
    foam = pack.material("Foam", tone("cream", "base"), roughness=0.94)
    wash = pack.material("Foam wash", tone("sea", "lit"), roughness=0.96)
    _poly("wash", [(-70.0, y - 1.4), (70.0, y - 1.4), (70.0, y + 0.5), (-70.0, y + 0.5)], 0.008, wash)
    groups = ((-26.0, 7.0), (-14.0, 9.0), (-1.0, 6.0), (7.0, 8.0), (18.0, 7.0))
    for gi, (gx, glen) in enumerate(groups):
        n = max(3, int(glen / 1.1))
        for i in range(n):
            fx = gx + i * (glen / (n - 1)) - glen / 2
            wx, wy = TURN(fx, y + math.sin(i * 2.1 + gi) * 0.35)
            h = 0.10 + ((i * 0.618) % 1.0) * 0.13
            pack.sphere(f"foam{gi}{i}", (wx, wy, h * 0.3), (1.15, 0.5, h), foam)


def _headland(y: float):
    far = pack.material("Headland", tone("stone", "base"), roughness=0.94)
    far_b = pack.material("Headland b", tone("stone", "lit"), roughness=0.94)
    for i in range(23):
        x = -34.0 + i * 3.0
        wx, wy = TURN(x, y + ((i * 0.618) % 1.0) * 2.0)
        # SMALL. At the scale the app shows this plate, headland hills of
        # h 1.6-3.0 came out as green pillows filling a fifth of the phone.
        # A far shore is a low band, not a range of hills.
        # Rounded mounds, not discs. At (2.2, 1.5) wide and 0.3 tall they
        # flattened into pale ellipses lying on the water -- lily pads.
        h = 1.0 + ((i * 0.382) % 1.0) * 0.7
        pack.sphere(f"head{i}", (wx, wy, h * 0.18), (1.7, 1.15, h * 0.85),
                    far if i % 2 else far_b)


def _dune(x: float, y: float, s: float = 1.0):
    """A sand dune. The first beach pass reused the park's shrub for these and
    put four green bushes on a beach, which is what happens when a builder is
    borrowed for its shape and not its material."""
    sand = pack.material(f"Dune{x:.1f}{y:.1f}", tone("sand", "base"), roughness=0.95)
    lit = pack.material(f"DuneLit{x:.1f}{y:.1f}", tone("sand", "lit"), roughness=0.94)
    for i, (dx, dy, dz, r) in enumerate((
        (0.0, 0.0, 0.30, 1.0), (-0.9, 0.2, 0.22, 0.75),
        (0.85, -0.15, 0.24, 0.8), (0.1, 0.5, 0.34, 0.62),
    )):
        wx, wy = TURN(x + dx * s * 1.6, y + dy * s * 1.6)
        pack.sphere(f"dune{x:.1f}{y:.1f}{i}", (wx, wy, dz * s),
                    (r * s * 1.9, r * s * 1.3, r * s * 0.52), lit if i == 3 else sand)
    for i in range(3):
        _marram(x + (i - 1) * 1.1 * s, y + 0.4 * s, 0.9 * s)


def _lifeguard(x: float, y: float, s: float = 1.0):
    post = pack.material("Tower post", tone("wood", "base"), roughness=0.86)
    body = pack.material("Tower body", tone("roof", "base"), roughness=0.74)
    roof = pack.material("Tower roof", tone("berry", "shade"), roughness=0.70)
    for dx, dy in ((-1.0, -0.8), (1.0, -0.8), (-1.0, 0.8), (1.0, 0.8)):
        lx, ly = TURN(x + dx * s, y + dy * s)
        pack.cylinder(f"post{dx}{dy}{x:.1f}", (lx, ly, 0.85 * s), 0.17 * s, 1.7 * s, post)
    bx, by = TURN(x, y)
    pack.cube(f"cab{x:.1f}", (bx, by, 2.55 * s), (1.45 * s, 1.25 * s, 1.05 * s), body, 0.12,
              rotation=(0, 0, THETA))
    pack.cube(f"roof{x:.1f}", (bx, by, 3.72 * s), (1.65 * s, 1.45 * s, 0.13 * s), roof, 0.07,
              rotation=(0, 0, THETA))
    glass = pack.material(f"Tower glass{x:.1f}", tone("sea", "pop"), roughness=0.30, coat=0.30)
    rail = pack.material(f"Tower rail{x:.1f}", tone("cream", "lit"), roughness=0.80)
    gx, gy = TURN(x, y - 1.2 * s)
    pack.cube(f"glass{x:.1f}", (gx, gy, 2.75 * s), (0.95 * s, 0.06 * s, 0.55 * s), glass, 0.05,
              rotation=(0, 0, THETA))
    for i, dz in enumerate((1.62, 1.95)):
        rx, ry = TURN(x, y - 1.28 * s)
        pack.cube(f"rail{x:.1f}{i}", (rx, ry, dz * s), (1.42 * s, 0.05 * s, 0.06 * s), rail, 0.02,
                  rotation=(0, 0, THETA))


def _umbrella(x: float, y: float, s: float = 1.0):
    pole = pack.material("Umbrella pole", tone("cream", "lit"), roughness=0.85)
    canopy = pack.material("Umbrella canopy", tone("foliage", "base"), roughness=0.70)
    knob = pack.material("Umbrella knob", tone("sun", "base"), roughness=0.60)
    px, py = TURN(x, y)
    pack.cylinder(f"upole{x:.1f}", (px, py, 1.5 * s), 0.09 * s, 3.0 * s, pole)
    pack.cone(f"ucan{x:.1f}", (px, py, 3.15 * s), 2.1 * s, 0.10 * s, 0.62 * s, canopy)
    pack.sphere(f"uknob{x:.1f}", (px, py, 3.55 * s), (0.16 * s, 0.16 * s, 0.16 * s), knob)


def _palm(x: float, y: float, s: float = 1.0):
    """A palm.

    Two passes wrong before this one, both the same mistake in different
    clothes: a frond is ONE long leaf, and I kept building it out of small
    round pieces. First seven flat discs in a ring around the crown -- lily
    pads. Then three discs per frond stepping outward -- still discs, just
    more of them. A shape that is 8:1 cannot be assembled out of shapes that
    are 1:1; it has to be one 8:1 shape, rotated to point where it goes.

    The trunk is one tapered cylinder with a lean, not a stack of segments.
    """
    trunk = pack.material(f"Palm trunk{x:.1f}", tone("bark", "lit"), roughness=0.90)
    trunk_hi = pack.material(f"Palm trunk hi{x:.1f}", tone("bark", "pop"), roughness=0.88)
    frond = pack.material(f"Palm frond{x:.1f}", tone("foliage", "base"), roughness=0.86)
    frond_hi = pack.material(f"Palm frond hi{x:.1f}", tone("foliage", "lit"), roughness=0.84)

    lean = 0.10
    height = 5.6 * s
    for i in range(7):
        t = i / 6.0
        tx, ty = TURN(x + lean * height * t, y)
        seg = pack.cylinder(f"pt{x:.1f}{i}", (tx, ty, height * t + 0.4 * s),
                            (0.30 - 0.13 * t) * s, 0.95 * s,
                            trunk_hi if i % 2 else trunk, vertices=14)
        seg.rotation_euler = (0.0, lean, 0.0)

    cx, cy = TURN(x + lean * height, y)
    crown = height + 0.4 * s
    for i in range(8):
        a = i / 8.0 * math.tau + 0.3
        droop = 0.42 + (i % 3) * 0.16
        leaf = pack.sphere(f"pf{x:.1f}{i}", (cx, cy, crown),
                           (2.6 * s, 0.34 * s, 0.10 * s),
                           frond_hi if i % 3 == 0 else frond)
        # Scale first, then aim it: out along `a`, and down by `droop`.
        leaf.rotation_euler = (0.0, droop, a + THETA)
        # Push it out from the crown so it hangs off the trunk rather than
        # through it.
        ox, oy = TURN(x + lean * height + math.cos(a) * 2.2 * s, y + math.sin(a) * 2.2 * s)
        leaf.location = (ox, oy, crown - math.sin(droop) * 1.9 * s)
    pack.sphere(f"pcrown{x:.1f}", (cx, cy, crown), (0.42 * s, 0.42 * s, 0.34 * s), trunk_hi)


def _castle(x: float, y: float, s: float = 1.0):
    sand = pack.material("Castle sand", tone("sand", "base"), roughness=0.94)
    flag = pack.material("Castle pennant cloth", tone("cream", "base"), roughness=0.70)
    stick = pack.material("Castle stick", tone("wood", "base"), roughness=0.88)
    for dx, dy, h in ((-0.85, 0.0, 1.15), (0.85, 0.0, 1.05), (0.0, -0.6, 1.45)):
        cx, cy = TURN(x + dx * s, y + dy * s)
        pack.cylinder(f"tw{x:.1f}{dx}", (cx, cy, h * 0.5 * s), 0.42 * s, h * s, sand, vertices=12)
    wx, wy = TURN(x, y - 0.6 * s)
    pack.cylinder(f"fstick{x:.1f}", (wx, wy, (1.45 + 0.4) * s), 0.04 * s, 0.8 * s, stick, vertices=8)
    pack.cube(f"flag{x:.1f}", (wx + 0.2 * s, wy, (1.45 + 0.62) * s), (0.24 * s, 0.02 * s, 0.16 * s), flag, 0.01)


def _towel(x: float, y: float, s: float = 1.0):
    """A towel laid on the sand. The middle of the frame was bare."""
    stripe_a = pack.material(f"Towel a{x:.1f}", tone("berry", "lit"), roughness=0.88)
    stripe_b = pack.material(f"Towel b{x:.1f}", tone("cream", "pop"), roughness=0.88)
    for i in range(4):
        wx, wy = TURN(x, y - 1.35 * s + i * 0.9 * s)
        pack.cube(f"towel{x:.1f}{i}", (wx, wy, 0.045 * s), (1.7 * s, 0.45 * s, 0.045 * s),
                  stripe_a if i % 2 else stripe_b, 0.03, rotation=(0, 0, THETA))


def _bucket(x: float, y: float, s: float = 1.0):
    body = pack.material(f"Bucket{x:.1f}", tone("sun", "lit"), roughness=0.70)
    handle = pack.material(f"Bucket handle{x:.1f}", tone("sea", "base"), roughness=0.66)
    bx, by = TURN(x, y)
    pack.cone(f"bucket{x:.1f}", (bx, by, 0.42 * s), 0.46 * s, 0.34 * s, 0.84 * s, body, vertices=20)
    pack.torus(f"bhandle{x:.1f}", (bx, by, 0.86 * s), 0.42 * s, 0.045 * s, handle,
               rotation=(math.pi / 2, 0, THETA))


def _pebble(x: float, y: float, s: float = 1.0):
    pebble = pack.material(f"Pebble{x:.2f}{y:.2f}", tone("stone", "lit") if (int(x * 7) % 2) else tone("stone", "base"), roughness=0.86)
    px, py = TURN(x, y)
    pack.sphere(f"peb{x:.2f}{y:.2f}", (px, py, 0.08 * s), (0.3 * s, 0.22 * s, 0.1 * s), pebble)


def _marram(x: float, y: float, s: float = 1.0):
    blade = pack.material(f"Marram{x:.2f}{y:.2f}", tone("grass", "lit"), roughness=0.90)
    for i in range(4):
        a = i * 1.7 + x
        lean = 0.30 + ((i * 0.618) % 1.0) * 0.22
        h = (0.5 + ((i * 0.382) % 1.0) * 0.35) * s
        bx, by = TURN(x + math.cos(a) * 0.10, y + math.sin(a) * 0.10)
        obj = pack.cone(f"mar{x:.2f}{y:.2f}{i}", (bx, by, h / 2), 0.04 * s, 0.004, h, blade,
                        rotation=(math.cos(a) * lean, math.sin(a) * lean, 0), vertices=8)
        obj.scale = (1.0, 0.3, 1.0)


SCENES = {
    "park": (park, 18.5, (0.0, 20.0, 1.0), 4.2, light_hex("key"), light_hex("fill")),
    "beach": (beach, 18.5, (0.0, 20.0, 1.0), 4.6, light_hex("key"), light_hex("fill")),
}


def main():
    only = os.environ.get("SCENE_ONLY", "").strip()
    # SCENE_ONLY NARROWS WHAT IS RENDERED, NEVER WHAT IS DESCRIBED.
    #
    # The prop pack carries this exact warning about PROP_ONLY and I wrote the
    # bug anyway: rendering one scene rewrote the manifest with only that
    # scene in it, so promoting after a `SCENE_ONLY=beach` run published a
    # manifest that had forgotten the park -- and the park plate, still on
    # disk and still shipping, would have had no anchors to stand the dog on.
    previous = {}
    manifest_path = OUT / "manifest.json"
    if manifest_path.exists():
        try:
            previous = json.loads(manifest_path.read_text(encoding="utf-8")).get("scenes", {})
        except (ValueError, OSError):
            previous = {}
    manifest = {
        "camera": "Barkly composed scene v1 (orthographic, one sun, EEVEE shadows + AO)",
        "contract": "one lit plate per location; app keeps sky, grade, and every dynamic object",
        "resolution": list(RESOLUTION),
        "scenes": dict(previous),
    }
    for name, (builder, ortho, target, energy, sun_hex, ambient) in SCENES.items():
        if only and name != only:
            continue
        clean()
        ANCHORS.clear()
        camera = setup(ortho, target, energy, sun_hex, ambient)
        builder()
        path = OUT / f"{name}.png"
        scene = bpy.context.scene
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        print(f"rendered {path}")

        w, h = RESOLUTION
        points = {}
        for key, co in ANCHORS.items():
            v = world_to_camera_view(scene, camera, Vector(co))
            points[key] = {"x": round(v.x, 6), "y": round(1.0 - v.y, 6)}
        entry = {"file": f"{name}.png", "width": w, "height": h, "anchors": points}
        if "stand" in points and "standTop" in points:
            # Pixels per world unit at the dog's feet: what the app scales him by.
            entry["unitPx"] = round(abs(points["stand"]["y"] - points["standTop"]["y"]) * h, 4)
        manifest["scenes"][name] = entry
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    if only:
        print(f"SCENE_ONLY={only}: rendered a subset; manifest still describes all")


if __name__ == "__main__":
    main()
