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
from palette import light_hex, sun_height, tone, world_rgb  # noqa: E402  -- the one place a colour comes from
from proportion import crown, shaft, stack  # noqa: E402  -- and the one place a SHAPE comes from
from ink import INK, contour_on  # noqa: E402  -- and the one place an EDGE comes from
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


def _ink_pass(scene):
    """Configure the Freestyle edge, or switch it off. Called by `setup`.

    THIS LIVES IN ITS OWN FUNCTION because the contour-off path returns
    early, and for one render it returned out of `setup` itself -- which
    meant that with the contour off there was no camera, no sun and no
    world, and Blender refused the frame with "Cannot render, no camera".
    A guard test that reads the file for `use_freestyle` assignments
    passed the whole time, because the defect was not in the assignment.
    """
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
    #
    # AND IT ASKS ink.CONTOUR, which it did not. This was a bare
    # `use_freestyle = True` that consulted nothing, so when the contour was
    # switched off game-wide the three PLATES kept theirs -- 4.69% of the park
    # plate was still ink pixels after the commit that said the outline had
    # come off everything. The plates are the largest art in the game, so that
    # is most of the change, and it is why the operator looked at the live
    # build and said he could not see a difference. He was right and the
    # measurement I offered as the explanation ("it is a subtle change") was
    # wrong: half of it had simply not been made.
    #
    # The other two consumers took the switch because they route through
    # `takes_ink()`. This one drew its own line and answered to nobody, which
    # is exactly the second-source-of-truth shape `ink.py` exists to prevent --
    # the file even names its three consumers, and this was one of them.
    scene.render.use_freestyle = contour_on()
    global NO_INK
    NO_INK = bpy.data.collections.new("Barkly no ink")
    scene.collection.children.link(NO_INK)
    if not contour_on():
        return
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
    # (The collection itself is made above, before the early return, because
    # builders call `no_ink()` whether or not a line is being drawn.)
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


def setup(ortho_scale: float, target, sun_energy: float, sun_color, ambient: str,
          scene_name: str = ""):
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
        # 0.8 -> 1.5, with the sky fill. Occlusion is the only dark a scene has
        # in the places a cast shadow cannot reach -- under a bench, inside a
        # gazebo, where a trunk meets the grass -- and at 0.8 it only found
        # contacts an inch apart. A longer reach is what turns "these two
        # objects touch" into "this object is standing in a place".
        ("gtao_distance", 1.5),
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

    _ink_pass(scene)

    # Ambient light stands in for the sky the app will draw behind this.
    scene.world.use_nodes = False
    # The sky, at the strength a surface sees it -- `palette.world_rgb`. This
    # was the ambient hex at full strength, a whole hemisphere of saturated
    # blue, and it was quietly taking half the chroma off every warm surface
    # in the game. `ambient` still names WHICH sky; the palette decides how
    # much of it there is, once, for both packs.
    scene.world.color = world_rgb()

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
    # A LOW SUN, and this is the last big one.
    #
    # Measured against the game's own hero -- which the palette file names as
    # the reference, because he is the thing that works -- the world was not
    # lit like him at all. Barkly puts 25.4% of his pixels below value 0.25;
    # the park plate put 4.9% there, and the Brawl Stars frame the operator
    # sent puts 18.8%. Saturation had reached the reference (park 0.52 against
    # its 0.52); tone had not, and it was not close.
    #
    # The cause is the sun's ELEVATION. At (-6, -4, 9) it stands 51 degrees up:
    # midday. Almost every surface in an open scene faces up at midday, so
    # almost every surface is lit, cast shadows are stubs directly under
    # things, and the only darks left in the picture are crevices. Barkly is
    # dark a quarter of the way through because he is a rounded form and a
    # quarter of him faces away from the key -- the world has no such luck,
    # because the world is mostly flat ground.
    #
    # 26 degrees is late afternoon. Shadows run about twice an object's height
    # instead of four fifths of it, the light rakes across vertical faces
    # instead of landing on their tops, and the ground gets large shadow SHAPES
    # -- which is what the reference frames are full of and ours had none of.
    # That is what the park and the beach take; town is the exception and the
    # table at SCENES says why.
    #
    # The HEIGHT is not written here. `palette.SUN_ELEVATION` holds the angle
    # for every scene and `palette.sun_height` turns it into a z for this rig's
    # own reach, so the prop pack -- whose lamp stands 7.2 units out where this
    # one stands 9.0 -- gets the SAME SUN rather than the same number.
    reach = math.hypot(7.5, 5.0)
    bpy.ops.object.light_add(type="SUN", location=(-7.5, -5.0, sun_height(reach, scene_name)))
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
    fill.data.energy = 60
    fill.data.size = 9.0
    fill.data.color = pack.rgb(light_hex("fill"))
    if hasattr(fill.data, "use_shadow"):
        fill.data.use_shadow = False
    pack.look_at(fill, aim)
    return camera


def ground(hex_near: str, hex_far: str = tone("grass", "lit"), centre: float = -48.5,
           size: float = 183.0, tooth: float = 26.0, bump: float = 0.10,
           patch: float = 0.16):
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
        noise_material("Ground", hex_near, hex_far, scale=patch, tooth=tooth, bump=bump))
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


def town():
    """The town, composed. Built 2026-09-10; this location had no plate at all.

    Town measured the worst of the four locations on every axis -- median
    saturation 0.292 against park's 0.495, 27.5% of its frame dark, 11.6% of it
    under 0.15 chroma -- and the reason was never its props. Park is a rendered
    plate and town was a code-drawn gradient with props composited onto it. One
    of four locations was art and three were CSS.

    The street runs across the frame rather than into it: shopfronts along the
    back, a road, a kerb, and the pavement the dog stands on. That is a stage
    set, and it is the right shape for a scene whose subject stands in the
    middle facing the camera.
    """
    # A BRICK PLAZA, not a concrete one.
    #
    # Plated, town still measured saturation 0.257 against park's 0.516, and
    # four separate attempts to close that failed for the same reason: its
    # ground is masonry. `paving` is chroma 0.42 and `grass` is 1.00, so a
    # street paved in concrete cannot measure like a lawn however it is lit,
    # and the app's master grade lays a violet bottom wash that a pale ground
    # shows and a saturated one absorbs.
    #
    # The answer is not to keep pushing a grey family toward colour until it
    # stops being grey -- that is the "street reads as a beach" mistake the
    # palette's own note warns about, approached from the other side. It is to
    # pave the plaza in something that HAS a colour. Brick is hue 10 at chroma
    # 0.80: a full-strength family, thirty degrees off sand so the two can
    # never be confused, and a red-tiled square is what the reference art puts
    # a town on. The kerb and the joints stay in `paving`, which is what they
    # are made of.
    # `base`->`lit`. Four pairs were measured in the app, and the ramp's own
    # shape decides it: the `lit` and `pop` steps carry the LOWEST saturation
    # multipliers (0.62 and 0.34), so paving the square at the top of the ramp
    # trades away the colour this change exists to get.
    #
    #   shade->base   sat 0.372  val 0.455   a deep maroon square the
    #                                        shopfronts had to compete with
    #   base->lit     sat 0.345  val 0.494   <- this
    #   lit->pop      sat 0.280  val 0.522   back to where concrete was
    #
    # Against town's composited 0.292 / 0.475 and park's 0.516 / 0.659.
    ground(tone("brick", "base"), tone("brick", "lit"), tooth=30.0, bump=0.07)
    _anchor("stand", 0.0, -3.0)
    _anchor("standTop", 0.0, -3.0, 1.0)
    _anchor("horizon", 0.0, 43.0)

    # THE ROAD, and the kerb that separates it from the pavement. Two real
    # planes at two heights, so the kerb throws a shadow along its own length
    # the way a kerb does.
    # NEARER AND LIGHTER. At y 24-33 the road pushed the shops beyond y 34,
    # where they read as a distant row of small buildings and two thirds of the
    # frame was empty pavement; and `stone.shade` under an ink outline came out
    # as a black river across the picture.
    _band("road", 20.0, 27.0, 0.004,
          depth_material("Road", tone("stone", "base"), tone("stone", "shade"), roughness=0.88))
    kerb = pack.material("Kerb", tone("paving", "lit"), roughness=0.86)
    # Its own tone. The kerb's face and the paving joints both landed on
    # `paving.shade`, and `tests/surface_grain` is right to refuse that: two
    # neighbouring things in one builder sharing a colour is how a scene
    # flattens one pair at a time.
    kerb_face = pack.material("Kerb face", tone("paving", "deep"), roughness=0.88)
    for i in range(26):
        x = -33.0 + i * 2.6
        wx, wy = TURN(x, 19.4)
        pack.cube(f"kerb{i}", (wx, wy, 0.16), (1.3, 0.62, 0.16), kerb, 0.05,
                  rotation=(0, 0, THETA))
        fx, fy = TURN(x, 20.0)
        pack.cube(f"kerbface{i}", (fx, fy, 0.09), (1.3, 0.05, 0.09), kerb_face, 0.03,
                  rotation=(0, 0, THETA))

    # THE SHOPS. Three colourways, alternating, wider than the frame so the row
    # reads as a street rather than as three buildings standing in a field.
    fronts = (
        ("Coral", tone("roof", "base"), tone("roof", "shade"), tone("roof", "lit")),
        ("Aqua", tone("sea", "base"), tone("sea", "shade"), tone("sea", "lit")),
        ("Violet", tone("grape", "base"), tone("grape", "shade"), tone("grape", "lit")),
    )
    for i, x in enumerate((-16.0, -9.6, -3.2, 3.2, 9.6, 16.0)):
        name, body, edge, awning = fronts[i % 3]
        place(lambda n=name, b=body, e=edge, a=awning: pack.storefront(n, b, e, a),
              x, 29.0 + (i % 2) * 1.1, 1.28, flip=(i % 2 == 1))

    # The town behind the town: a rooftop band far enough back to be a horizon.
    place(pack.town_rooftops, 0.0, 42.0, 2.6)
    place(pack.town_rooftops, -9.0, 47.0, 2.2, flip=True)
    place(pack.town_rooftops, 9.5, 46.0, 2.3)

    # STREET FURNITURE, on the pavement, clear of the middle where the dog and
    # the two NPCs stand.
    place(pack.town_fountain, -5.4, 11.0, 1.55)
    # The two near lamps publish where their LIT PANE lands, so the app's night
    # glow sits on the glass that is painted into the plate instead of on a
    # position computed from a sprite the plated path no longer draws. The
    # lantern centre is at z 3.45 on the prop (`town_lamp`: `stack(3.01, 0.60)`).
    place(pack.town_lamp, -7.9, 3.0, 1.4)
    _anchor("lampLeft", -7.9, 3.0, 3.45 * 1.4)
    place(pack.town_lamp, 8.1, 1.0, 1.35, flip=True)
    _anchor("lampRight", 8.1, 1.0, 3.45 * 1.35)
    place(pack.town_lamp, -6.6, 16.0, 1.1)
    place(pack.town_lamp, 7.2, 17.0, 1.05, flip=True)
    place(pack.town_planter, -4.0, 5.5, 1.25)
    place(pack.town_planter, 5.4, 7.0, 1.2, flip=True)
    place(pack.town_planter, 7.6, 13.5, 1.05)
    place(pack.park_bench, -7.4, -2.0, 1.2)
    place(pack.park_bench, 7.8, 8.5, 1.05, flip=True)

    # Street trees. A high street with no green in it reads as a warehouse row,
    # and they give the shot the vertical mass the shopfronts alone do not.
    _tree(-10.8, 16.5, 1.35)
    _tree(11.4, 18.0, 1.3)

    # THE PROSCENIUM. Same rule as the park's: near, large, mostly off-stage,
    # wide of x = +-4 where the app draws the dog, PEPPER and the care tray.
    # FURTHER OUT. At x = -12.4 the canopy still hung across the middle of the
    # picture over the bench; the park's own note says the same thing about the
    # same mistake -- "a proscenium is mostly off-stage".
    _tree(-12.9, -12.0, 2.9, canopy=tone("foliage", "shade"), trunk=tone("bark", "base"))
    _tree(13.3, -10.0, 2.8, canopy=tone("foliage", "base"), trunk=tone("bark", "lit"))
    # ...and NOT giant flowerpots. Two planters at scale 2.4 on the bottom
    # corners read as garden centre stock, not as a street. A lamp is the thing
    # a street actually has at that size, and its post is narrow enough to
    # frame without blocking.
    # 1.5, not 2.1: at that size the post filled the bottom corner as a plain
    # grey pillar with its lantern cropped off the top, which frames nothing.
    place(pack.town_lamp, -8.7, -12.0, 1.5)
    place(pack.town_lamp, 9.0, -14.0, 1.45, flip=True)

    # The near pavement, which was an empty grid. The app covers the bottom
    # eighth with the care tray, but the band just under the dog is in shot and
    # was bare.
    place(pack.park_bench, -6.4, -9.0, 1.35)
    place(pack.town_planter, 6.6, -7.0, 1.4, flip=True)
    place(pack.town_planter, -3.9, -17.0, 1.55)

    # Paving joints, as geometry rather than as three drawn hairlines. The
    # app's own note on `TOWN_PAVING_COURSES` calls the old version "one fill
    # with three drawn hairlines on it pretending to be slab joints".
    # NO INK ON THEM, and this is the same lesson the grass taught twice: a
    # joint is 0.055 wide and the ink line is wider than that, so the first
    # pass drew the pavement as a black grid over the whole lower half of the
    # frame. `no_ink` plus one step of contrast is a joint; an outline is a
    # fence.
    joint = pack.material("Paving joint", tone("brick", "shade"), roughness=0.92)
    for i in range(15):
        y = -26.0 + i * 3.4
        if y > 18.0:
            break
        wx, wy = TURN(0.0, y)
        no_ink(pack.cube(f"joint{i}", (wx, wy, 0.012), (34.0, 0.05, 0.012), joint, 0.01,
                         rotation=(0, 0, THETA)))
    for i in range(19):
        x = -30.0 + i * 3.4
        wx, wy = TURN(x, -4.0)
        no_ink(pack.cube(f"jointx{i}", (wx, wy, 0.012), (0.05, 22.0, 0.012), joint, 0.01,
                         rotation=(0, 0, THETA)))

    # Scatter: a few tufts pushing through the joints, which is what makes a
    # pavement look walked-on rather than laid this morning.
    for i in range(26):
        t = (i * 0.6180339887) % 1.0
        u = (i * 0.3819660113) % 1.0
        x = -14.0 + t * 28.0
        y = -22.0 + u * 44.0
        if abs(x) < 3.5 and y < 2.0:
            continue
        if y > 18.0:
            continue
        _tuft(x, y, 0.45 + u * 0.35)


def noise_material(name: str, hex_a: str, hex_b: str, scale: float = 0.16,
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
    coord = nt.nodes.new("ShaderNodeTexCoord")
    tex = nt.nodes.new("ShaderNodeTexNoise")
    # OBJECT COORDINATES, for the same reason the tooth below uses them, and
    # this one was measured wrong for four passes.
    #
    # A noise node with nothing in Vector falls back to GENERATED, which is
    # normalised 0..1 across the object's bounding box -- and this plane's
    # bounding box is 183 units wide. At the old scale of 1.5 that is one and
    # a half cycles across the WHOLE FIELD, while the camera sees about
    # twenty-five units of it: the visible ground traverses a fifth of one
    # cycle, the ramp barely moves, and the field renders as one flat colour.
    # Measured on the style probe the operator judged: the open sunlit grass
    # held a value sd of 0.0186 over ninety-one thousand pixels -- a range of
    # 0.075 across the entire field. That is the "completely flat green" he
    # was looking at, and no amount of light rig fixes it, because the ALBEDO
    # was never varying in the first place.
    #
    # On object coordinates `scale` is cycles per world unit, exactly as
    # `tooth` is, so 0.16 means a patch about six units across -- big enough
    # to read as ground rather than noise, small enough that several fall
    # inside the frame.
    nt.links.new(coord.outputs["Object"], tex.inputs["Vector"])
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


def depth_material(name: str, hex_near: str, hex_far: str, roughness: float = 0.90,
                   self_lit: float = 0.0):
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
    #
    # WATER CARRIES ITS OWN LIGHT, and a diffuse surface cannot say so.
    #
    # The sea is one huge horizontal plane, which means the sun strikes it at
    # the same glancing angle it strikes the sand -- so when the sun came down
    # to 26 degrees, the sea came down with it, from mean value 0.49 to 0.31.
    # That is a dark teal slab with a hard edge along the top, and it is wrong
    # in a way the sand at the same elevation is not: almost none of real
    # water's brightness is the sun landing on it. It is the SKY, reflected.
    #
    # Modelling it as a little EMISSION says that, and it has a second virtue:
    # it decouples the sea from the sun, so the beach's elevation can be chosen
    # for its SAND and its palm shadows rather than propped up to stop its
    # water going black.
    #
    # THE COLOUR IS THE SURFACE'S OWN, not the sky lamp's. The first version
    # emitted `light_hex("fill")` -- literally the sky, which is the more
    # physical story -- and it made the sea GREY: that lamp is deliberately a
    # low-chroma daylight blue (saturation 0.30), so adding it to every channel
    # washed the water out. Measured in the app, the sea band went value
    # 0.53 -> 0.61 and saturation 0.55 -> 0.36, which is a brighter version of
    # the wrong problem. A cartoon sea is not a grey mirror; it is a saturated
    # blue that is brighter than the light falling on it, because sky, depth
    # and caustics are all doing something a diffuse lobe cannot.
    #
    # Emitting the material's OWN near colour says that and stays general: any
    # depth_material can be told to carry its own light without importing a
    # second opinion about what colour it is.
    if self_lit:
        bsdf.inputs["Emission Color"].default_value = (*pack.rgb(hex_near), 1.0)
        bsdf.inputs["Emission Strength"].default_value = self_lit
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
    stone = pack.material(f"Band stone{x:.1f}", tone("stone", "base"), roughness=0.90)

    # THE DECK, and it needs to MEET THE GROUND.
    #
    # It was two stacked discs, which from this camera is a tan plate floating
    # over the grass with the path running under it -- and because the path
    # recedes straight away from the deck's centre, the two together read as a
    # trunk with a canopy on top. The park's landmark looked like a tree.
    #
    # A plinth that widens downward and three real steps on the camera side
    # are what turn a floating disc into a building standing on the ground.
    pack.cylinder(f"bandbase{x:.1f}", (cx, cy, 0.30 * s), 3.05 * s, 0.60 * s, base, vertices=24)
    pack.cylinder(f"bandplinth{x:.1f}", (cx, cy, 0.09 * s), 3.34 * s, 0.18 * s, stone, vertices=24)
    for i, (w, depth, z) in enumerate(((1.55, 0.62, 0.42), (1.75, 0.62, 0.26),
                                       (1.95, 0.62, 0.10))):
        sx, sy = TURN(x, y - (2.95 + i * 0.52) * s)
        pack.cube(f"bandstep{x:.1f}{i}", (sx, sy, z * s),
                  (w * s, depth * s, (z + 0.09) * s), stone, rotation=(0, 0, THETA))

    # THE COLUMNS. Base, shaft, capital -- and the capital is the half of it
    # that was missing. A tapered cone standing on a disc with nothing on top
    # is a fang; what says "column" is that it visibly CARRIES something, and
    # that is a wider block at the head taking the ring above it.
    for i in range(6):
        a = i / 6.0 * math.tau + 0.26
        px, py = TURN(x + math.cos(a) * 2.42 * s, y + math.sin(a) * 2.42 * s)
        pack.cylinder(f"bandfoot{x:.1f}{i}", (px, py, 0.72 * s), 0.34 * s, 0.26 * s,
                      post, vertices=12, taper=0.86)
        # Barely tapered: 0.28 -> 0.25 over its length. `shaft()` took it to a
        # third of its base, which is a spike, not a post.
        pack.cylinder(f"bandpost{x:.1f}{i}", (px, py, 1.96 * s), 0.26 * s, 2.22 * s,
                      post, vertices=12, taper=0.90)
        pack.cylinder(f"bandcap{x:.1f}{i}", (px, py, 3.18 * s), 0.35 * s, 0.24 * s,
                      post, vertices=12, taper=1.0)

    # THE BALUSTRADE, which did not exist. The code that claimed to build it
    # put six short cylinders AT the six post positions -- inside the posts,
    # spanning nothing, invisible in every render since. A railing is the
    # thing between two posts, so it is built from the CHORD: a panel at the
    # midpoint of each adjacent pair, turned to lie along it, with a rail over
    # it. That is also what makes the bandstand read as enclosed below and
    # open above, which is the silhouette the docstring above promises.
    step = math.tau / 6.0
    for i in range(6):
        a0 = i * step + 0.26
        a1 = a0 + step
        mid = (a0 + a1) / 2.0
        # The chord's midpoint sits inside the post circle by cos(half-angle).
        r = 2.42 * s * math.cos(step / 2.0)
        mx, my = TURN(x + math.cos(mid) * r, y + math.sin(mid) * r)
        half = 2.42 * s * math.sin(step / 2.0)
        yaw = THETA + mid + math.pi / 2.0
        pack.cube(f"bandpanel{x:.1f}{i}", (mx, my, 1.06 * s),
                  (half * 0.92, 0.08 * s, 0.46 * s), trim, rotation=(0, 0, yaw))
        # The rail's own yaw is `yaw - 90`, not `yaw`, and the first render
        # showed exactly why: a cylinder points along Z, tipping it by 90
        # degrees about X lays it along Y, and the Z rotation that follows
        # then puts it at yaw PLUS ninety. Handed the panel's yaw it came out
        # radial -- six battering rams sticking out of the bandstand.
        pack.cylinder(f"bandrail{x:.1f}{i}", (mx, my, 1.58 * s), 0.09 * s, half * 1.92,
                      post, rotation=(math.pi / 2, 0, yaw - math.pi / 2),
                      vertices=10, taper=1.0)

    pack.cylinder(f"bandring{x:.1f}", (cx, cy, 3.40 * s), 2.66 * s, 0.24 * s, trim, vertices=24)
    # THE ROOF HAS THICKNESS AND AN EAVE, because a cone has neither.
    #
    # This was one 6-sided cone: a hexagonal pyramid whose rim comes to a
    # mathematical zero -- a paper edge -- overhanging the ring below it by
    # 0.23, which at plate scale is nothing. Photographed next to the fountain
    # (the prop the operator picked out as right) the difference is not colour
    # or light: every part of the fountain is a closed form with a rolled edge,
    # and this was a folded sheet of paper.
    #
    # Three parts. A wider cone for the eave, a short cylinder under its rim
    # that gives the edge a real face to catch light on, and the cone itself
    # sitting on top. PITCH, not just width: the first version widened the
    # cone and kept its old depth, which turned it into a saucer.
    pack.cylinder(f"bandeave{x:.1f}", (cx, cy, 3.66 * s), 3.05 * s, 0.30 * s, roof,
                  vertices=6, taper=0.95)
    pack.cone(f"bandroof{x:.1f}", (cx, cy, 4.66 * s), 2.92 * s, 0.20 * s, 1.92 * s, roof, vertices=6)
    # Hip ribs down the six seams. A flat-shaded pyramid reads as a paper
    # pentagon at this size -- the flat-cel style probe made that plain -- and
    # a rib per seam is what gives the roof edges of its own to catch light on
    # rather than relying on the facets happening to face differently.
    for i in range(6):
        a = i / 6.0 * math.tau
        rr = 2.98 * s * 0.5
        rx, ry = TURN(x + math.cos(a) * rr, y + math.sin(a) * rr)
        pack.cube(f"bandrib{x:.1f}{i}", (rx, ry, 4.62 * s),
                  (0.07 * s, 1.55 * s, 0.07 * s),
                  trim, rotation=(math.atan2(1.92 * s, 2.92 * s), 0, THETA + a + math.pi / 2))
    pack.sphere(f"bandfin{x:.1f}", (cx, cy, 5.74 * s), (0.20 * s, 0.20 * s, 0.28 * s), finial)


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
    # A CLUSTER, matching park/tree.png lobe for lobe. Three bumps sunk into
    # one big ellipsoid gave a smooth mass with a single outline: measured,
    # 0.83% of the prop's interior carried any ink at all against the
    # fountain's 12.5%, because Freestyle draws silhouette and border and two
    # smoothly interpenetrating spheres share neither. Six squashed lobes,
    # each tilted off axis and sitting proud enough to keep an arc of its own
    # outline, and the low two in the shade tone so the canopy has an
    # underside. The plate's tree and the modular tree have to be the same
    # tree or the park is two parks.
    for i, (dx, dy, dz, r, sq, tilt, mat) in enumerate((
        (-0.58, -0.40, 0.56, 1.04, 0.64, (-0.20, 0.24), leaf_hi),
        (0.52, 0.04, 0.62, 0.86, 0.58, (0.16, -0.30), leaf_hi),
        (1.52, 0.28, -0.06, 0.92, 0.62, (-0.12, 0.34), leaf),
        (-1.56, 0.32, -0.14, 0.86, 0.58, (0.22, -0.26), leaf),
        (1.02, 0.50, -0.56, 0.72, 0.46, (-0.26, 0.14), leaf),
        (-0.94, 0.48, -0.60, 0.66, 0.44, (0.28, 0.20), leaf),
    )):
        lx, ly = TURN(x + dx * s, y + dy * s)
        pack.sphere(f"leaf{x:.1f}{y:.1f}_{i}",
                    (lx, ly, crown_z + dz * s),
                    (r * s, r * 0.86 * s, sq * s),
                    mat, rotation=(tilt[0], tilt[1], 0.0))


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

    RE-COMPOSED 2026-09-10, against the park as the bar. This plate had been
    BUILT and deliberately held back on quality, and three things were wrong
    with it that had nothing to do with lighting:

    - The dunes sat at y 14-22, which is at the WATER. Dunes are landward. They
      were also the flat modular prop, which projects to an ellipse from this
      camera and reads as a crater once inked (see `_dune`).
    - There was no proscenium. Park frames its shot with two near trees mostly
      out of frame; the beach framed nothing, so it read as five objects on an
      empty tan field.
    - The "wet sand" band was `tone("sand", "base")` -- the SAME TONE as the dry
      ground it was drawn on. The tide line has been invisible since it was
      written.
    """
    ground(tone("sand", "base"), tone("sand", "lit"), tooth=38.0, bump=0.09)
    _anchor("stand", 0.0, -3.0)
    _anchor("standTop", 0.0, -3.0, 1.0)
    _anchor("horizon", 0.0, 43.0)

    # THE TIDE LINE, at last visible. Wet sand is darker and glossier than dry
    # -- that is the whole of what makes a shoreline read -- and this band was
    # painted in the dry sand's own colour. Two steps down the ramp and a real
    # coat, ramped so the strip nearest the water is wettest.
    # ...and not so dark it becomes a SHELF. shade->deep put a near-black strip
    # across the full width of the frame with a hard top edge, which reads as a
    # step down to the water rather than as damp sand. It darkens toward the
    # sea, where the water actually is, and the near end is only one step under
    # the dry ground it continues.
    wet = depth_material("Wet sand", tone("sand", "base"), tone("sand", "shade"),
                         roughness=0.42)
    _band("wet", 19.4, 25.4, 0.006, wet)

    # Shallows to deep water, as one continuous ramp.
    _band("sea", 25.0, 43.0, 0.005,
          depth_material("Sea", tone("sea", "base"), tone("sea", "shade"), self_lit=0.22))

    _surf(25.0)
    _headland(40.0)

    # THE BACK OF THE BEACH. Low mounds behind the tide line give the sand a
    # far edge that is not the sea, small enough to read as distance.
    for dx, dy, ds in ((-7.4, 15.5, 0.85), (7.2, 14.0, 0.8), (-5.2, 20.5, 0.62), (6.0, 21.0, 0.6)):
        _dune(dx, dy, ds, flip=dx > 0)

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

    # THE PROSCENIUM, which this plate did not have.
    #
    # The park's note says it plainly: near, large, and deliberately cropped by
    # the frame -- they are the proscenium, not scenery, and mostly off-stage.
    # The frame is x = +-9.25. An earlier pass rejected the palm four times for
    # covering whatever stood behind it; that is a placement answer, not a
    # verdict on the prop. Out at the corners with its trunk off-camera it
    # covers nothing and holds the edge of the shot, which is the one job it
    # was never given.
    # AT the edge, not past it. At x = -11.4 the trunk was entirely off-camera
    # and only frond tips reached in, which reads as loose grass floating in
    # mid-air rather than as a tree holding the corner. The frame is +-9.25:
    # the trunk wants to be just inside it.
    place(pack.beach_palm, -9.0, -13.0, 1.85)
    place(pack.beach_palm, 9.4, -11.0, 1.75, flip=True)
    # NO NEAR DUNES. Two passes at them and from this camera the near corners
    # are seen almost from above, where even a hemisphere projects to a disc --
    # they came out as two pale ellipses on the bottom edge, which is the
    # crater read all over again in the one place the eye lands first. The
    # palms hold the corners; a dune cannot, at this pitch, this close.

    # The middle, which was bare sand. Kept clear of x = +-3 below the stand
    # line, where the dog, the SIFT mound and the two NPCs go.
    # A BEACH IS A FLAT PLANE, which is the whole difficulty: the park gets its
    # structure free from trees and this has none. So the middle distance has
    # to be furnished, and with things that stand UP -- a second umbrella and a
    # windbreak do more for the shot than any amount of scatter on the floor.
    place(pack.beach_umbrella, -5.4, 4.5, 0.95)
    _windbreak(4.6, 12.0, 1.0)
    _towel(1.9, -2.4, 1.05)
    _towel(-6.6, 9.0, 0.9)
    _bucket(-3.4, -10.5, 0.85)
    _bucket(6.9, -3.5, 0.7)
    _beachball(-4.6, -4.0, 1.0)
    _beachball(7.8, 2.0, 0.75)
    _driftwood(-5.6, 0.5, 1.1)
    _driftwood(7.9, 8.5, 0.9)
    _starfish(3.9, 7.0, 1.2)
    _starfish(-2.2, 16.5, 1.0)

    # THE NEAR BAND, which was bare. The scatter reaches down here but shells
    # and marram are too small to read at the bottom of the frame; near ground
    # wants near-sized objects. Kept outside x = +-4, where the app draws the
    # care tray, the SIFT mound and the dog himself.
    _driftwood(-6.9, -15.0, 1.9)
    _driftwood(7.6, -19.0, 1.7)
    _rocks(-5.2, -21.0, 1.5)
    _rocks(6.2, -13.0, 1.1)
    _bucket(-8.0, -6.5, 1.0)

    # Scatter: shells, pebbles and marram, thinning toward the water. 34 was
    # not enough to be texture and too many to be objects; the park runs 70
    # tufts over a comparable field.
    for i in range(76):
        t = (i * 0.6180339887) % 1.0
        u = (i * 0.3819660113) % 1.0
        x = -13.5 + t * 27.0
        y = -25.0 + u * 50.0
        if abs(x) < 3.0 and y < 0.0:
            continue
        if y > 19.0:
            continue  # past the tide line is water, and nothing grows in it
        if i % 4 == 0:
            _pebble(x, y, 0.7 + u * 0.7)
        elif i % 4 == 1:
            _shells(x, y, 0.8 + u * 0.5)
        else:
            _marram(x, y, 0.8 + u * 0.6)


def _rocks(x: float, y: float, s: float = 1.0):
    """A cluster of three, for the near ground. Sea-worn: rounded, no facets."""
    a = pack.material(f"Rock a{x:.1f}{y:.1f}", tone("stone", "base"), roughness=0.90)
    b = pack.material(f"Rock b{x:.1f}{y:.1f}", tone("stone", "shade"), roughness=0.92)
    c = pack.material(f"Rock c{x:.1f}{y:.1f}", tone("stone", "lit"), roughness=0.88)
    for i, (dx, dy, r, mat) in enumerate((
        (0.0, 0.0, 0.62, a), (-0.72, 0.22, 0.42, b), (0.64, -0.18, 0.34, c),
    )):
        wx, wy = TURN(x + dx * s, y + dy * s)
        pack.sphere(f"rock{x:.1f}{y:.1f}{i}", (wx, wy, r * s * 0.62),
                    (r * s, r * s * 0.82, r * s * 0.72), mat)


def _windbreak(x: float, y: float, s: float = 1.0):
    """Striped canvas between poles. The one piece of beach furniture that is
    tall, flat-on to the camera and unmistakable at any size."""
    pole = pack.material(f"Wind pole{x:.1f}", tone("wood", "base"), roughness=0.80)
    stripes = (
        pack.material(f"Wind a{x:.1f}", tone("berry", "base"), roughness=0.86),
        pack.material(f"Wind b{x:.1f}", tone("cream", "pop"), roughness=0.86),
        pack.material(f"Wind c{x:.1f}", tone("sea", "base"), roughness=0.86),
    )
    span = 3.4 * s
    for i in range(6):
        px = x - span / 2 + i * (span / 5.0)
        wx, wy = TURN(px, y)
        pack.cube(f"windpanel{x:.1f}{i}", (wx, wy, 0.62 * s),
                  (span / 10.0, 0.06 * s, 0.62 * s), stripes[i % 3], 0.04,
                  rotation=(0, 0, THETA))
    for i in (0, 5):
        px = x - span / 2 + i * (span / 5.0)
        wx, wy = TURN(px, y - 0.04 * s)
        pack.cylinder(f"windpole{x:.1f}{i}", (wx, wy, 0.72 * s), 0.075 * s, 1.44 * s,
                      pole, vertices=12, taper=0.86)


def _shells(x: float, y: float, s: float = 1.0):
    """A couple of shells. The scatter was pebbles and grass and nothing else,
    on a beach, while `beach/shells` has existed as a prop the whole time."""
    place(pack.beach_shells, x, y, 0.9 * s, flip=(int(x * 5) % 2 == 0))


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


def _dune(x: float, y: float, s: float = 1.0, flip: bool = False):
    """A sand dune, as a MOUND. Two things this had wrong at once.

    It had no caller. `beach()` was placing `pack.beach_dune` -- the modular
    prop, built to be seen alone at 158pt -- and this builder sat here unused,
    which is the exact thing rule zero forbids.

    And the prop is the wrong shape for a plate. It is a sphere squashed to
    (1.65, 0.66, 0.42): two and a half times wider than tall. Seen from this
    camera's 22-degree pitch that projects to an ELLIPSE, and once the ink pass
    outlines an ellipse lying on sand you have drawn a crater. Five of them
    across the beach plate, which is what held it back.

    A dune reads as a dune because its crest breaks the line of the sand behind
    it. So this is tall relative to its width, asymmetric -- windward slope long
    and shallow, leeward short and steep, which is what makes a sand shape look
    like sand -- and its marram grows on the crest where marram grows.
    """
    sand = pack.material(f"Dune{x:.1f}{y:.1f}", tone("sand", "base"), roughness=0.95)
    lit = pack.material(f"DuneLit{x:.1f}{y:.1f}", tone("sand", "lit"), roughness=0.94)
    shade = pack.material(f"DuneShade{x:.1f}{y:.1f}", tone("sand", "shade"), roughness=0.95)
    # TALL ENOUGH TO BE A HILL. The first rewrite was still 2.6 times wider
    # than high and still projected to a disc; a mound only stops reading as a
    # crater when its crest genuinely rises out of the plane. Width and height
    # are now within a third of each other, and the pale "sunlit shoulder"
    # sphere is gone -- a bright patch inside a dark outline is the exact thing
    # that made these look like holes rather than heaps.
    d = -1.0 if flip else 1.0
    for i, (dx, dy, dz, rx, ry, rz, mat) in enumerate((
        (0.00, 0.00, 0.30, 1.55, 1.15, 1.45, sand),        # the crest
        (-1.20 * d, 0.30, 0.10, 1.25, 0.95, 0.95, shade),  # the long windward slope
        (0.95 * d, -0.25, 0.14, 0.95, 0.80, 1.05, lit),    # the short leeward one
    )):
        wx, wy = TURN(x + dx * s * 1.5, y + dy * s * 1.5)
        pack.sphere(f"dune{x:.1f}{y:.1f}{i}", (wx, wy, dz * s),
                    (rx * s * 1.5, ry * s * 1.35, rz * s), mat)
    for i in range(4):
        _marram(x + (i - 1.5) * 0.95 * s, y - 0.25 * s, 0.95 * s)


def _beachball(x: float, y: float, s: float = 1.0):
    """The one saturated round thing on a beach of tan and blue."""
    a = pack.material(f"Ball a{x:.1f}", tone("berry", "base"), roughness=0.52, coat=0.10)
    b = pack.material(f"Ball b{x:.1f}", tone("cream", "pop"), roughness=0.54, coat=0.10)
    c = pack.material(f"Ball c{x:.1f}", tone("sea", "base"), roughness=0.52, coat=0.10)
    bx, by = TURN(x, y)
    pack.sphere(f"ball{x:.1f}", (bx, by, 0.52 * s), (0.52 * s, 0.52 * s, 0.52 * s), a)
    for i, mat in enumerate((b, c)):
        pack.cube(f"ballband{x:.1f}{i}", (bx, by, 0.52 * s),
                  (0.14 * s, 0.53 * s, 0.53 * s), mat, 0.05,
                  rotation=(0, 0, THETA + i * 1.05))


def _starfish(x: float, y: float, s: float = 1.0):
    star = pack.material(f"Star{x:.1f}{y:.1f}", tone("roof", "base"), roughness=0.86)
    sx, sy = TURN(x, y)
    pack.sphere(f"starmid{x:.1f}{y:.1f}", (sx, sy, 0.05 * s), (0.20 * s, 0.20 * s, 0.06 * s), star)
    for i in range(5):
        a = i * math.tau / 5 + x
        ax, ay = TURN(x + math.cos(a) * 0.26 * s, y + math.sin(a) * 0.26 * s)
        pack.cone(f"stararm{x:.1f}{y:.1f}{i}", (ax, ay, 0.045 * s),
                  0.13 * s, 0.02 * s, 0.30 * s, star,
                  rotation=(math.pi / 2, 0, THETA + a + math.pi / 2), vertices=8)


def _driftwood(x: float, y: float, s: float = 1.0):
    wood = pack.material(f"Drift{x:.1f}{y:.1f}", tone("cream", "base"), roughness=0.92)
    dark = pack.material(f"DriftDark{x:.1f}{y:.1f}", tone("bark", "shade"), roughness=0.94)
    wx, wy = TURN(x, y)
    pack.cylinder(f"drift{x:.1f}{y:.1f}", (wx, wy, 0.16 * s), 0.16 * s, 2.1 * s, wood,
                  rotation=(0, math.pi / 2, THETA + 0.3), vertices=14, taper=0.72)
    bx, by = TURN(x + 0.75 * s, y + 0.16 * s)
    pack.cylinder(f"driftarm{x:.1f}{y:.1f}", (bx, by, 0.26 * s), 0.075 * s, 0.8 * s, dark,
                  rotation=(0, math.radians(58), THETA + 0.9), vertices=10, taper=0.7)


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
        # no_ink, same as the park's tufts: a marram blade is 0.04 wide and
        # squashed to 0.3 of that in y, so the Freestyle line is wider than the
        # blade and fills it in. On the beach plate they came out as a scatter
        # of black spiders on the sand.
        obj = no_ink(pack.cone(f"mar{x:.2f}{y:.2f}{i}", (bx, by, h / 2), 0.04 * s, 0.004, h, blade,
                               rotation=(math.cos(a) * lean, math.sin(a) * lean, 0), vertices=8))
        obj.scale = (1.0, 0.3, 1.0)


# name: (builder, ortho scale, camera target, sun energy, sun colour, sky)
#
# NO SUN HEIGHT COLUMN, and that is deliberate. It was one for a while, and a
# per-scene z in this tuple is a per-scene z that only this file knows about --
# which is exactly how the prop pack ended up lighting a bench at midday to
# stand on a lawn lit at four. The elevations live in `palette.SUN_ELEVATION`
# and `setup()` reads them by scene name, so every pack asks the same table.
#
# What that table says about these three, and why:
#
#   park, beach   26 degrees   shadows about twice an object's height
#   town          50 degrees   shadows about 0.85x
#
# A low sun is what gives a picture large shadow SHAPES rather than stubs under
# things, and that is most of the tonal range the reference has and this world
# did not. How low depends on what is STANDING in the scene: an open field can
# take a raking light because the only things casting are its own trees, and a
# street cannot, because a row of two-storey shopfronts at 26 degrees throws
# its shadow across the entire square in front of them. Town was measured at
# all three -- 26 gave median value 0.34 with 25.1% of the frame under 0.25,
# 40 gave 0.41 and 22.4%, and both left a plaza whose near half sat in the
# shadow of its own shopfronts. A square is the one place in this game the
# player STANDS and taps, and a raking light across it costs more than the
# drama is worth.
#
# THE ENERGIES came up with it (4.2/4.6/5.0 -> 9.2/9.8/8.4) because
# `SKY_FILL_STRENGTH` went the other way, 0.45 -> 0.11. The hemisphere was
# doing a share of the lighting and stopped; without the key making that up,
# lowering the sun would just be an underexposure. Contrast is the goal, not
# darkness. Town takes the least of the three because its ground is a brick
# plaza facing straight up into a 50-degree sun.
SCENES = {
    "park": (park, 18.5, (0.0, 20.0, 1.0), 9.2, light_hex("key"), light_hex("fill")),
    "beach": (beach, 18.5, (0.0, 20.0, 1.0), 9.8, light_hex("key"), light_hex("fill")),
    "town": (town, 18.5, (0.0, 20.0, 1.0), 8.4, light_hex("key"), light_hex("fill")),
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
        camera = setup(ortho, target, energy, sun_hex, ambient, name)
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
