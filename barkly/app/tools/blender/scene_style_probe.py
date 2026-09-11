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

ROUNDS = {"1": ROUND_ONE, "2": ROUND_TWO}
STYLES = ROUNDS[os.environ.get("PROBE_ROUND", "2")]
PREFIX = "scene__" if os.environ.get("PROBE_ROUND", "2") == "1" else "r2__"

_ORIG_MATERIAL = pack.material
_ORIG_SETUP = scenes.setup
_ORIG_GROUND = scenes.ground
_ORIG_CONTOUR = ink.CONTOUR
_ORIG_ELEVATION = dict(__import__("palette").SUN_ELEVATION)


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


def apply(style):
    import palette
    ink.CONTOUR = style.get("contour", False)
    palette.SUN_ELEVATION[SCENE] = style.get("elevation", _ORIG_ELEVATION[SCENE])

    shading = style.get("shading", "default")

    def material_shim(name, color, roughness=0.55, metallic=0.0, coat=0.04, surface=None):
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
        for obj in scene.objects:
            if obj.type == "LIGHT" and obj.data.type == "SUN":
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
    for name, style in STYLES.items():
        import palette
        pack.material = _ORIG_MATERIAL
        scenes.pack.material = _ORIG_MATERIAL
        scenes.setup = _ORIG_SETUP
        scenes.ground = _ORIG_GROUND
        ink.CONTOUR = _ORIG_CONTOUR
        palette.SUN_ELEVATION.update(_ORIG_ELEVATION)
        apply(style)

        scenes.clean()
        scenes.ANCHORS.clear()
        scenes.setup(ortho, target, energy, sun_hex, ambient, SCENE)
        builder()
        bpy.context.scene.render.filepath = str(OUT / f"{PREFIX}{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"scene probe {name}  ({style.get('label', name)})")
    print(f"wrote {len(STYLES)} scene renders to {OUT}")


if __name__ == "__main__":
    main()
