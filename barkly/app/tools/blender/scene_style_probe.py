"""WHOLE SCENES in several styles, because two props on a beige square is not
a test anyone can answer.

Operator: *"I need more than just a fucking lamp and a bench though to tell if
I like the art style or not."* Correct, and the earlier measurement says the
same thing from the other side: a hedge is about 3% of the screen and a planter
2%, so a style judged on isolated props is a style judged on 5% of the picture.
What carries a frame is the ground, the sky, the plate and the light -- all of
which only exist at SCENE scale.

So this renders the PARK PLATE, whole, once per style, and composites each one
into a phone-shaped crop with Barkly standing in it. Same builder, same camera,
same palette; only the style dials move.

    xvfb-run -a blender -b --python tools/blender/scene_style_probe.py

Writes art-review/style-probe/scene__<style>.png. Like the prop probe, nothing
here feeds the shipped packs -- it imports them, sets module globals, and
writes to its own directory.
"""
from __future__ import annotations

import math
import os
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import palette  # noqa: E402
import world_prop_pack as pack  # noqa: E402
import world_scene_pack as scenes  # noqa: E402
import ink  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "art-review" / "style-probe"
SCENE = "park"

#: name -> (label, dials)
#:
#: `contour`    the game's dark edge, on or off (ink.CONTOUR)
#: `fill_scale` multiplier on the sky-bounce fill: how dark the darks get
#: `rim`        an area light behind, for a lit edge on every silhouette
#: `ao`         (distance, factor) for contact occlusion
#: `shading`    "default" or "cel"
#: `sun_scale`  multiplier on the key
#: `sun_angle`  the sun's angular diameter in degrees -- how soft a cast
#:              shadow's edge grows as it runs away from what casts it
#: `cascade`    shadow cascade max distance: how many texels the sun spends
#:              on the part of the scene the camera can actually see
#: `patch`      ground colour-patch frequency, cycles per world unit
#: `bump`       ground relief strength
#: `elevation`  sun height for this scene, in degrees
ROUND_ONE = {
    "1-now": dict(label="AS IT SHIPS NOW"),
    "2-inked": dict(label="OUTLINE BACK ON", contour=True),
    "3-contrast": dict(label="HIGH CONTRAST + RIM", fill_scale=0.30, rim=5.0,
                       ao=(2.4, 1.0), sun_scale=1.15),
    "4-cel": dict(label="CEL / BANDED", shading="cel", bands=3),
    "5-soft": dict(label="SOFT MATTE", fill_scale=1.9, sun_scale=0.8, ao=(1.0, 0.5)),
    "6-golden": dict(label="LOW GOLDEN SUN", sun_scale=1.25, fill_scale=0.55,
                     rim=2.5, elevation=18.0),
}

#: ROUND TWO. The operator picked #3 out of round one -- *"this is the best but
#: there are still leaps and bounds that need to be made and the shading
#: sucks"* -- so every entry below INHERITS #3's rig and moves one thing.
#:
#: Two defects were fixed at source before this round rather than offered as
#: choices, because neither is a matter of taste:
#:
#:   * the contour was still on. `world_scene_pack` set `use_freestyle = True`
#:     unconditionally, so round one's "outline off" and "outline on" rendered
#:     IDENTICALLY (measured: mean 0.000/255) and every scene the operator
#:     judged still carried a heavy black edge he had already rejected.
#:   * the ground was one flat colour. Its noise ramp ran on GENERATED
#:     coordinates across a 183-unit plane, so the visible frame crossed a
#:     fifth of one cycle: open sunlit grass held a value sd of 0.0186 over
#:     91,000 pixels. That is the "flat green", and it was albedo, not light.
#:
#: What is left to judge is the SHADING, which is what he actually said.
BASE = dict(fill_scale=0.30, rim=5.0, ao=(2.4, 1.0), sun_scale=1.15)


def _v(label, **dials):
    return dict(BASE, label=label, **dials)


ROUND_TWO = {
    # The control: round one's winner, with the two defects above repaired.
    "1-fixed": _v("#3 WITH THE TWO BUGS FIXED"),
    # A cast shadow should have a SHAPE. At a 3.2-degree sun the penumbra
    # grows about 56mm per metre of run, and at 26 degrees a tree's shadow
    # runs twice its height -- so the far end of every shadow is a smudge.
    "2-crisp": _v("CRISP SHADOWS", sun_angle=1.0, cascade=60.0),
    # The opposite reading: keep them soft but give them somewhere to be, by
    # spending the sun's texels on the visible scene instead of 200 units.
    "3-defined": _v("SOFT BUT RESOLVED", sun_angle=2.2, cascade=45.0),
    # A hard terminator over the contrast rig -- the toon reading.
    "4-toon": _v("CEL OVER CONTRAST", shading="cel", bands=3, sun_angle=1.0,
                 cascade=60.0),
    "5-toon4": _v("CEL, FOUR BANDS", shading="cel", bands=4, sun_angle=1.4,
                  cascade=60.0),
    # Ground that carries its own value, not just the light landing on it.
    "6-terrain": _v("GROUND WITH TERRAIN IN IT", patch=0.34, bump=0.22,
                    sun_angle=1.0, cascade=60.0),
    # Deeper contact darks: the thing that makes a form sit ON something.
    "7-contact": _v("DEEP CONTACT SHADOW", ao=(4.0, 1.0), fill_scale=0.22,
                    sun_angle=1.0, cascade=60.0),
    # Late afternoon, crisp: long shapes with edges.
    "8-lowsun": _v("LOW SUN, CRISP", elevation=19.0, sun_angle=0.9,
                   cascade=60.0, sun_scale=1.3),
}

#: ROUND THREE. *"There needs to be more variability between each scene. I
#: can't tell the difference between them."* Correct, and measurable: five of
#: round two's eight sat inside 2% of each other on every column -- flat
#: 0.080-0.083, darks 26-28%, saturation 0.50 to two decimals. That round
#: moved DIALS (sun disc, cascade depth, occlusion reach) on one art
#: direction, and those are finishing controls. They cannot produce options
#: somebody can choose between.
#:
#: So each entry here is a different art direction, and the levers are the
#: ones that change a whole frame at once:
#:
#:   `sky_fill`  how much hemisphere light fills the shadows -- the single
#:               biggest contrast control in the pack (palette explains why
#:               it is 0.11 in production, and why lowering the sun without
#:               it buys nothing)
#:   `key_hex`   the sun's colour: the picture's temperature
#:   `world_hex` the render world's own colour, which is what the shadow side
#:               of every surface is made of
#:   `elevation` where the sun stands, in degrees
#:   `shadow`    False for no cast shadow at all -- the overcast reading
#:   `volume`    world volume scatter: real atmosphere, and depth from haze
#:               rather than from value
#:
#: `scripts/probe-sheet.py --matrix` prints the pairwise difference between
#: every pair and fails if any two are closer than the round-two options
#: were, so this cannot quietly happen again.
ROUND_THREE = {
    "1-golden": dict(label="GOLDEN HOUR", elevation=12.0, sun_scale=1.55,
                     key_hex="#FFCE86", sky_fill=0.06, rim=3.0, ao=(2.6, 1.0),
                     sun_angle=1.0, cascade=60.0),
    # sun_scale 1.25 blew 63% of the ground to pure white. A high sun already
    # puts the key nearly normal to a flat field, so the production energy is
    # too much before any multiplier -- this is the one entry that wants LESS.
    "2-noon": dict(label="HARD NOON", elevation=72.0, sun_scale=0.62,
                   sky_fill=0.22, ao=(1.6, 1.0), sun_angle=0.8, cascade=60.0),
    "3-overcast": dict(label="OVERCAST TOY", shadow=False, sky_fill=0.85,
                       fill_scale=3.2, sun_scale=0.35, ao=(3.6, 1.0)),
    "4-twotone": dict(label="HARD TWO-TONE", shading="cel", bands=2,
                      sky_fill=0.05, elevation=30.0, sun_scale=1.2,
                      sun_angle=0.8, cascade=60.0),
    "5-dusk": dict(label="DUSK, COOL SHADOW", elevation=8.0, sun_scale=1.35,
                   key_hex="#FFB067", world_hex="#2A3A72", sky_fill=0.34,
                   rim=4.0, sun_angle=1.0, cascade=60.0),
    "6-haze": dict(label="ATMOSPHERIC HAZE", volume=0.010, elevation=16.0,
                   sun_scale=1.9, key_hex="#FFDCA6", sky_fill=0.10,
                   sun_angle=1.0, cascade=60.0),
    "7-popbright": dict(label="HIGH-KEY POP", elevation=52.0, sun_scale=1.45,
                        sky_fill=0.40, fill_scale=1.8, ao=(1.2, 0.7),
                        sun_angle=2.4),
    "8-storybook": dict(label="STORYBOOK MATTE", elevation=38.0, sun_scale=1.0,
                        key_hex="#FFE9CB", sky_fill=0.26, fill_scale=2.2,
                        ao=(3.2, 1.0), sun_angle=3.6, patch=0.30, bump=0.20),
}

#: ROUND FOUR -- ART STYLES. *"I meant variability in art styles not the sun
#: position."* Round three moved the LIGHT: eight sun positions, one
#: rendering language. That is a different picture but the same art.
#:
#: So every entry below is lit IDENTICALLY -- same sun, same height, same
#: fill, same rim -- and what changes is how a surface is drawn: how rough it
#: is, whether it has a coat, whether its normals are smoothed or faceted,
#: how much tooth and mottle sit on it, whether the terminator is a gradient
#: or a hard band, and whether there is a line around it.
#:
#: `LIT` is the constant. Nothing in a style may touch it; anything that does
#: is a lighting change wearing a style's name, which is what round three
#: already answered.
LIT = dict(fill_scale=0.30, rim=5.0, ao=(2.4, 1.0), sun_scale=1.15,
           sun_angle=1.0, cascade=60.0)


def _s(label, **dials):
    return dict(LIT, label=label, **dials)


ROUND_FOUR = {
    # Collectible vinyl: hard clearcoat, tight highlight, no surface at all.
    "1-vinyl": _s("VINYL TOY", roughness=0.26, coat=0.95, surface="smooth"),
    # Stop-motion clay: dead matte, and tooth EVERYWHERE -- the thing that
    # says "somebody's thumb was here" is fine relief catching a raking key.
    "2-clay": _s("STOP-MOTION CLAY", roughness=0.94, coat=0.0,
                 bump_scale=3.4, grain_scale=0.55, mottle_scale=1.8),
    # Faceted: normals left flat, so every curve becomes planes that each take
    # the light as one value. Geometry as style, not texture.
    "3-facet": _s("LOW-POLY FACET", flat_shade=True, roughness=0.52, coat=0.06,
                  surface="smooth"),
    # Flat fill with a hard terminator and no specular anywhere.
    "4-cel": _s("FLAT CEL", shading="cel", bands=3, roughness=1.0, coat=0.0,
                surface="smooth"),
    # Fabric: dense fine fuzz, fully rough, light scattering off a nap.
    "5-plush": _s("PLUSH FELT", roughness=1.0, coat=0.0, bump_scale=4.2,
                  tooth_scale=2.6, mottle_scale=1.4),
    # Paint: the variation is in the COLOUR, broad and brushy, not in relief.
    "6-gouache": _s("PAINTED GOUACHE", roughness=0.88, coat=0.0,
                    mottle_scale=3.2, grain_scale=0.32, bump_scale=0.5),
    # The storybook reading: flat fill plus the drawn line back on.
    "7-inked": _s("INKED STORYBOOK", shading="cel", bands=3, contour=True,
                  roughness=1.0, coat=0.0, mottle_scale=1.6, grain_scale=0.4),
    # Candy gloss: saturation up, roughness down, coat hard.
    "8-candy": _s("GLOSS CANDY", roughness=0.14, coat=1.0, sat_boost=1.28,
                  surface="smooth"),
}

#: ROUND FIVE -- ART STYLES THAT SURVIVE BEING SMALL.
#:
#: Round four was the right question and half the wrong answers. It offered
#: clay, felt and gouache, and the matrix measured them 0.4 to 0.9 apart out
#: of 255: at a whole-park camera on a phone, a grain at 150 cycles per world
#: unit is smaller than a pixel. Micro-surface is not an art style here, it is
#: an invisible one. Faceting was the same story from the other side -- the
#: flat-shade pass worked, but the props carry enough subdivision that the
#: facets came out sub-pixel too, which is why `decimate` exists below: low
#: poly is GEOMETRY, and you have to actually remove the geometry.
#:
#: What did measure, at 12 out of 255, was the number of TONES a surface is
#: broken into. So round five only pulls levers with area behind them:
#:
#:   `bands`     how many tones, with a hard terminator (or smooth, for none)
#:   `contour`   whether there is a drawn line -- and it works now; round four
#:               rendered its inked style and its flat style 0.0 apart because
#:               `from ink import CONTOUR` had frozen a copy of the switch
#:   `sat_boost` the palette's chroma, up or down
#:   `roughness` / `coat` -- specular as a big soft sheen or none at all
#:   `decimate`  collapse the mesh until the planes are large enough to see
ROUND_FIVE = {
    "1-smooth": _s("SMOOTH GRADIENT (now)"),
    "2-cel3": _s("THREE-TONE CEL", shading="cel", bands=3, roughness=1.0,
                 coat=0.0, surface="smooth"),
    "3-cel2": _s("TWO-TONE, HARDEST", shading="cel", bands=2, roughness=1.0,
                 coat=0.0, surface="smooth"),
    "4-celink": _s("CEL + DRAWN LINE", shading="cel", bands=3, contour=True,
                   roughness=1.0, coat=0.0, surface="smooth"),
    "5-lowpoly": _s("TRUE LOW POLY", decimate=0.09, flat_shade=True,
                    roughness=0.55, coat=0.05, surface="smooth"),
    "6-candy": _s("GLOSS CANDY", roughness=0.13, coat=1.0, sat_boost=1.30,
                  surface="smooth"),
    "7-muted": _s("MUTED STORYBOOK", roughness=0.95, coat=0.0, sat_boost=0.62,
                  surface="smooth"),
    "8-brawl": _s("BANDED + SATURATED + RIM", shading="cel", bands=4,
                  sat_boost=1.22, rim=8.0, roughness=1.0, coat=0.0,
                  surface="smooth"),
}

#: ROUND SIX -- EIGHT ART DIRECTIONS, each measured far from the other seven.
#:
#: Rounds three through five between them answer what actually changes this
#: picture at the size it is played, and the answer is narrower than it
#: looks. Measured as mean per-channel difference over the framed tile:
#:
#:   the LIGHT                        12 - 76    (round three)
#:   smooth gradient vs cel banding   12 - 13    (round five)
#:   the drawn line, over cel          3 - 6
#:   saturation up or down             3 -  8
#:   three bands versus two            0.8
#:   flat-shading, decimation          2.0
#:   clay / felt / gouache surface     0.4 - 0.9 (round four)
#:
#: The bottom half of that list is invisible at a whole-park camera on a
#: phone: a grain at 150 cycles per world unit is sub-pixel, and the props
#: carry enough subdivision that faceting them is too. Which is why round
#: four's eight "art styles" came back as three, and round five's as three
#: again -- authoring more material treatments cannot produce more choices
#: than the material axis contains.
#:
#: So each entry here is a whole art direction: a shading language AND the
#: light that belongs with it, named for what it is rather than for the dial
#: it moves. `--matrix` holds them apart.
ROUND_SIX = {
    "1-soft": dict(label="SOFT REALIST (now)", **LIT),
    "2-storefront": dict(label="CEL STOREFRONT", shading="cel", bands=3,
                         roughness=1.0, coat=0.0, surface="smooth",
                         # 1.45 with a 0.40 sky clipped a quarter of the
                         # frame to white; a bright style still has to have
                         # somewhere above its highlights to go.
                         elevation=52.0, sun_scale=0.80, sky_fill=0.34,
                         fill_scale=1.6, ao=(1.2, 0.7), sun_angle=2.0),
    "3-storybook": dict(label="STORYBOOK INK", shading="cel", bands=3,
                        contour=True, roughness=1.0, coat=0.0,
                        surface="smooth", sat_boost=0.72, shadow=False,
                        sky_fill=0.85, fill_scale=3.2, sun_scale=0.35,
                        ao=(3.6, 1.0)),
    "4-brawl": dict(label="BRAWL: BANDED, LIT, RIMMED", shading="cel",
                    bands=4, roughness=1.0, coat=0.0, surface="smooth",
                    sat_boost=1.24, rim=8.0, elevation=14.0, sun_scale=1.5,
                    key_hex="#FFCE86", sky_fill=0.07, ao=(2.6, 1.0),
                    sun_angle=1.0, cascade=60.0),
    "5-candy": dict(label="CANDY GLOSS", roughness=0.13, coat=1.0,
                    surface="smooth", sat_boost=1.30, elevation=72.0,
                    sun_scale=0.62, sky_fill=0.22, ao=(1.6, 1.0),
                    sun_angle=0.8, cascade=60.0),
    "6-watercolour": dict(label="WATERCOLOUR HAZE", roughness=0.92, coat=0.0,
                          surface="smooth", sat_boost=0.66, volume=0.010,
                          elevation=16.0, sun_scale=1.9, key_hex="#FFDCA6",
                          sky_fill=0.10, sun_angle=1.0, cascade=60.0),
    "7-graphic": dict(label="GRAPHIC NOVEL", shading="cel", bands=2,
                      contour=True, roughness=1.0, coat=0.0, surface="smooth",
                      elevation=8.0, sun_scale=1.35, key_hex="#FFB067",
                      world_hex="#2A3A72", sky_fill=0.34, rim=4.0,
                      sun_angle=1.0, cascade=60.0),
    "8-painterly": dict(label="SUNSET PAINTERLY", roughness=0.88, coat=0.0,
                        mottle_scale=3.2, grain_scale=0.32, elevation=12.0,
                        sun_scale=1.55, key_hex="#FFCE86", sky_fill=0.06,
                        rim=3.0, ao=(2.6, 1.0), sun_angle=1.0, cascade=60.0),
}

#: ROUND SEVEN -- SIX THAT ARE ALL CANDIDATES.
#:
#: Round six cleared the distance bar and the operator threw out half of it:
#: *"watercolour all the way sucks... why the fuck is that just getting raped
#: by the sun... it has to be something we could actually use. Give me good
#: ones."* He was right, and `probe-sheet --matrix` now agrees with him
#: independently -- its usability floor flags the fog-washed entry (no darks
#: at all), the desaturated one, and both of the ones raked by a sub-15-degree
#: sun. Being far from the other seven was never the same as being a
#: candidate.
#:
#: So everything here stays inside the band that produces a usable frame:
#: real cast shadows, no volumetric haze, the sun between 24 and 50 degrees,
#: nothing clipped. The variety comes from the levers that survive that
#: constraint -- banding, the drawn line, chroma, gloss, and a rim -- which
#: round five measured as the ones with area behind them anyway.
ROUND_SEVEN = {
    "1-soft": dict(label="SOFT REALIST (ships now)", **LIT),
    "2-storefront": dict(label="CEL, BRIGHT", shading="cel", bands=3,
                         roughness=1.0, coat=0.0, surface="smooth",
                         elevation=46.0, sun_scale=0.82, sky_fill=0.30,
                         fill_scale=1.5, ao=(1.6, 0.9), sun_angle=1.6,
                         cascade=60.0),
    "3-inked": dict(label="CEL + DRAWN LINE", shading="cel", bands=3,
                    contour=True, roughness=1.0, coat=0.0, surface="smooth",
                    elevation=34.0, sun_scale=1.05, sky_fill=0.17,
                    ao=(2.2, 1.0), sun_angle=1.2, cascade=60.0),
    "4-brawl": dict(label="BANDED, SATURATED, RIMMED", shading="cel", bands=4,
                    roughness=1.0, coat=0.0, surface="smooth", sat_boost=1.20,
                    rim=6.5, elevation=30.0, sun_scale=1.15,
                    key_hex="#FFD9A6", sky_fill=0.13, ao=(2.4, 1.0),
                    sun_angle=1.0, cascade=60.0),
    "5-candy": dict(label="GLOSS CANDY", roughness=0.15, coat=1.0,
                    surface="smooth", sat_boost=1.26, elevation=44.0,
                    sun_scale=0.90, sky_fill=0.24, ao=(1.8, 1.0),
                    sun_angle=1.2, cascade=60.0),
    # Landed 6.0 from the baseline on its first render -- exactly the floor,
    # which is a pass on a technicality. A warmer key and a darker sky are
    # what separate "afternoon" from "midday" without dropping the sun to the
    # raking angle that made round six's painterly entry unusable.
    "6-afternoon": dict(label="WARM AFTERNOON", roughness=0.80, coat=0.10,
                        key_hex="#FFC47E", elevation=24.0, sun_scale=1.42,
                        sky_fill=0.09, rim=6.0, ao=(2.9, 1.0), sun_angle=1.0,
                        cascade=60.0, patch=0.26, bump=0.16),
}

ROUNDS = {"1": ROUND_ONE, "2": ROUND_TWO, "3": ROUND_THREE, "4": ROUND_FOUR,
          "5": ROUND_FIVE, "6": ROUND_SIX, "7": ROUND_SEVEN}
ROUND = os.environ.get("PROBE_ROUND", "7")
STYLES = ROUNDS[ROUND]
PREFIX = "scene__" if ROUND == "1" else f"r{ROUND}__"

_ORIG_MATERIAL = pack.material
_ORIG_SETUP = scenes.setup
_ORIG_GROUND = scenes.ground
_ORIG_CONTOUR = ink.CONTOUR
_ORIG_ELEVATION = dict(__import__("palette").SUN_ELEVATION)
_ORIG_SKY_FILL = __import__("palette").SKY_FILL_STRENGTH
_ORIG_SURFACES = {k: (None if v is None else dict(v))
                  for k, v in pack.SURFACES.items()}
_ORIG_FAMILIES = dict(__import__("palette").FAMILIES)


def _cel(mat, bands):
    """Quantise shading into flat bands with a hard terminator (EEVEE)."""
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    out = nt.nodes.get("Material Output")
    if bsdf is None or out is None:
        return mat
    to_rgb = nt.nodes.new("ShaderNodeShaderToRGB")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    emit = nt.nodes.new("ShaderNodeEmission")
    mix = nt.nodes.new("ShaderNodeMixRGB")
    nt.links.new(bsdf.outputs["BSDF"], to_rgb.inputs["Shader"])
    nt.links.new(to_rgb.outputs["Color"], ramp.inputs["Fac"])
    ramp.color_ramp.interpolation = "CONSTANT"
    elements = ramp.color_ramp.elements
    while len(elements) > 1:
        elements.remove(elements[-1])
    elements[0].position = 0.0
    elements[0].color = (0.48, 0.48, 0.48, 1.0)
    for i in range(1, bands):
        e = elements.new(i / bands)
        v = 0.48 + (1.15 - 0.48) * (i / max(1, bands - 1))
        e.color = (v, v, v, 1.0)
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 1.0
    mix.inputs["Color2"].default_value = bsdf.inputs["Base Color"].default_value
    nt.links.new(ramp.outputs["Color"], mix.inputs["Color1"])
    nt.links.new(mix.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def _atmosphere(scene, density, style):
    """Real air: a world volume scatter, so distance costs contrast.

    Every other lever here changes how a surface takes light. This one puts
    something BETWEEN the camera and the surface, which is the one way to get
    depth that does not come out of the value range -- the far treeline goes
    pale because there are eighty units of air in front of it, not because it
    was painted pale. It also gives the sun shafts to cut, which is the whole
    look.
    """
    world = scene.world
    world.use_nodes = True
    nt = world.node_tree
    for node in list(nt.nodes):
        nt.nodes.remove(node)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (*palette.world_rgb(), 1.0)
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    scatter = nt.nodes.new("ShaderNodeVolumeScatter")
    scatter.inputs["Color"].default_value = (*pack.rgb(style.get("key_hex", "#FFE6C2")), 1.0)
    scatter.inputs["Density"].default_value = density
    scatter.inputs["Anisotropy"].default_value = 0.45
    nt.links.new(scatter.outputs["Volume"], out.inputs["Volume"])
    for attr, value in (("use_volumetric_shadows", True),
                        ("volumetric_end", 140.0),
                        ("volumetric_samples", 96)):
        if hasattr(scene.eevee, attr):
            try:
                setattr(scene.eevee, attr, value)
            except (TypeError, ValueError):
                pass


def apply(style):
    import palette
    ink.CONTOUR = style.get("contour", False)
    palette.SUN_ELEVATION[SCENE] = style.get("elevation", _ORIG_ELEVATION[SCENE])
    # The world's ambient strength is a PALETTE constant, and it is the
    # largest single contrast control the pack has: the sun cuts a long
    # shadow and the hemisphere fills it straight back in, so a style that
    # moves one without the other moves almost nothing.
    palette.SKY_FILL_STRENGTH = style.get("sky_fill", _ORIG_SKY_FILL)

    # The SURFACE table is what makes clay clay and felt felt. Scaling it is
    # how a style changes substance without touching a single builder.
    pack.SURFACES = {
        key: (None if spec is None else dict(
            spec,
            grain=spec["grain"] * style.get("grain_scale", 1.0),
            tooth=spec["tooth"] * style.get("tooth_scale", 1.0),
            bump=spec["bump"] * style.get("bump_scale", 1.0),
            mottle=spec["mottle"] * style.get("mottle_scale", 1.0),
        ))
        for key, spec in _ORIG_SURFACES.items()
    }
    boost = style.get("sat_boost", 1.0)
    palette.FAMILIES = {
        name: (hue, min(1.0, sat * boost), lift)
        for name, (hue, sat, lift) in _ORIG_FAMILIES.items()
    }

    shading = style.get("shading", "default")

    def material_shim(name, color, roughness=0.55, metallic=0.0, coat=0.04, surface=None):
        # The builders author roughness and coat PER PROP -- glass is not
        # bark. A style that assigns one number flattens that away, so these
        # blend toward the style's value rather than replacing it: a style
        # says "everything here is glossier", not "everything here is one
        # material".
        want_rough = style.get("roughness")
        if want_rough is not None:
            roughness = roughness * 0.35 + want_rough * 0.65
        want_coat = style.get("coat")
        if want_coat is not None:
            coat = coat * 0.35 + want_coat * 0.65
        if style.get("surface") is not None:
            surface = style["surface"]
        mat = _ORIG_MATERIAL(name, color, roughness, metallic, coat, surface)
        if shading == "cel":
            _cel(mat, style.get("bands", 3))
        return mat

    pack.material = material_shim
    scenes.pack.material = material_shim

    def ground_shim(*args, **kwargs):
        for dial in ("patch", "bump"):
            if dial in style:
                kwargs[dial] = style[dial]
        return _ORIG_GROUND(*args, **kwargs)

    scenes.ground = ground_shim

    def setup_shim(ortho_scale, target, sun_energy, sun_color, ambient, scene_name=""):
        camera = _ORIG_SETUP(ortho_scale, target, sun_energy * style.get("sun_scale", 1.0),
                             sun_color, ambient, scene_name)
        scene = bpy.context.scene
        fill_scale = style.get("fill_scale", 1.0)
        if fill_scale != 1.0:
            for obj in scene.objects:
                if obj.type == "LIGHT" and "bounce" in obj.name.lower():
                    obj.data.energy *= fill_scale
        rim = style.get("rim", 0.0)
        if rim:
            bpy.ops.object.light_add(type="AREA", location=(6.0, 30.0, 9.0))
            light = bpy.context.object
            light.name = "Probe rim"
            light.data.energy = rim * 220.0
            light.data.size = 24.0
            light.data.color = pack.light_rgb("key")
            pack.look_at(light, target)
        ao = style.get("ao")
        if ao:
            scene.eevee.gtao_distance, scene.eevee.gtao_factor = ao
        world_hex = style.get("world_hex")
        if world_hex:
            # The shadow side of every surface in the frame is made of this.
            scene.world.color = tuple(
                c * palette.SKY_FILL_STRENGTH for c in pack.rgb(world_hex))
        volume = style.get("volume")
        if volume:
            _atmosphere(scene, volume, style)
        for obj in scene.objects:
            if obj.type == "LIGHT" and obj.data.type == "SUN":
                key_hex = style.get("key_hex")
                if key_hex:
                    obj.data.color = pack.rgb(key_hex)
                if style.get("shadow", True) is False:
                    # No cast shadow at all. Everything that reads as form is
                    # then occlusion and the terminator, which is what a toy
                    # photographed in a lightbox looks like.
                    obj.data.use_shadow = False
                angle = style.get("sun_angle")
                if angle is not None:
                    obj.data.angle = math.radians(angle)
                cascade = style.get("cascade")
                if cascade is not None and hasattr(obj.data, "shadow_cascade_max_distance"):
                    # The sun spreads one shadow map over `cascade` units of
                    # depth. Blender's default is 200, and this camera sees
                    # about 60 -- so better than two thirds of every texel was
                    # being spent behind the treeline.
                    obj.data.shadow_cascade_max_distance = cascade
                    if hasattr(scene.eevee, "shadow_cascade_size"):
                        scene.eevee.shadow_cascade_size = "4096"
        return camera

    scenes.setup = setup_shim


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    builder, ortho, target, energy, sun_hex, ambient = scenes.SCENES[SCENE]
    # Re-render ONE entry without redoing the round. A style probe is
    # iterative by nature -- round three's hard-noon option came back with
    # 63% of its ground blown to white -- and a two-minute fix that costs a
    # twenty-minute re-render does not get made.
    only = [n.strip() for n in os.environ.get("PROBE_ONLY", "").split(",") if n.strip()]
    if only:
        missing = [n for n in only if n not in STYLES]
        if missing:
            raise SystemExit(
                f"PROBE_ONLY names no style in round {ROUND}: {missing}. "
                f"Known: {sorted(STYLES)}")
    written = 0
    for name, style in STYLES.items():
        if only and name not in only:
            continue
        import palette
        pack.material = _ORIG_MATERIAL
        scenes.pack.material = _ORIG_MATERIAL
        scenes.setup = _ORIG_SETUP
        scenes.ground = _ORIG_GROUND
        ink.CONTOUR = _ORIG_CONTOUR
        palette.SUN_ELEVATION.update(_ORIG_ELEVATION)
        palette.SKY_FILL_STRENGTH = _ORIG_SKY_FILL
        pack.SURFACES = {k: (None if v is None else dict(v))
                         for k, v in _ORIG_SURFACES.items()}
        palette.FAMILIES = dict(_ORIG_FAMILIES)
        apply(style)

        scenes.clean()
        scenes.ANCHORS.clear()
        scenes.setup(ortho, target, energy, sun_hex, ambient, SCENE)
        builder()
        ratio = style.get("decimate")
        if ratio:
            # ACTUALLY REMOVE THE GEOMETRY. Flat-shading alone gave facets
            # smaller than a pixel, because the props are built from
            # subdivided primitives -- round four measured that "low poly"
            # 1.9 from the smooth one. Collapsing the mesh first is what makes
            # a plane big enough to read as a plane.
            for obj in list(bpy.context.scene.objects):
                if obj.type != "MESH" or len(obj.data.polygons) < 40:
                    continue
                mod = obj.modifiers.new("probe decimate", "DECIMATE")
                mod.ratio = ratio
                bpy.context.view_layer.objects.active = obj
                try:
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                except RuntimeError:
                    obj.modifiers.remove(mod)
        if style.get("flat_shade"):
            # Faceting is GEOMETRY, not material, so it cannot go through the
            # material shim -- it has to run after the props exist. The packs
            # smooth-shade by angle on the way in; this undoes that, and every
            # curve becomes planes that each take the key as one flat value.
            for obj in bpy.context.scene.objects:
                if obj.type != "MESH":
                    continue
                for poly in obj.data.polygons:
                    poly.use_smooth = False
                if hasattr(obj.data, "use_auto_smooth"):
                    obj.data.use_auto_smooth = False
        bpy.context.scene.render.filepath = str(OUT / f"{PREFIX}{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"scene probe {name}  ({style.get('label', name)})")
        written += 1
    # `len(STYLES)` here said "wrote 8" after a PROBE_ONLY run that made one.
    print(f"wrote {written} scene render(s) to {OUT}")


if __name__ == "__main__":
    main()
