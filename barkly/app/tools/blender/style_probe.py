"""EIGHT RENDERS SO A STYLE CAN BE CHOSEN BY LOOKING, not argued about.

The operator, on a contact sheet: "the bench doesn't even look like the same
art style as the lamp." That is a real observation and it has a real cause --
this pack has a dozen dials that each got set on the prop in front of me at the
time (edge weight, ink thickness, coat, bevel share), so props authored in
different sessions carry different combinations of them.

This renders the SAME TWO PROPS under four whole-pack styles. Same builders,
same camera, same light, same palette -- only the style dials move. Bench and
lamp specifically, because they are the two the operator named, and because
one is a slatted box and the other is a tiered column: a style that only works
on one of them is not a style.

    xvfb-run -a blender -b --python tools/blender/style_probe.py

Writes art-review/style-probe/<style>__<prop>.png. NOTHING in this file feeds
the shipped packs -- it imports them, sets module globals, and puts its output
in its own directory, so a probe can never leak into the game. When a style is
chosen, its numbers are moved into the packs by hand and this stays as the
record of what was compared.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import world_prop_pack as pack  # noqa: E402
from ink import INK  # noqa: E402
from palette import tone  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "art-review" / "style-probe"

#: The props under test, and why these two. See the module docstring.
PROPS = ("park/bench", "town/lamp")

#: name -> (what it is, dials)
#:
#: `edge_share`   how fat a moulded edge is, as a share of the form's smallest
#:                dimension (world_prop_pack._edge_for)
#: `edge_cap`     the ceiling on that, so a big form does not get a huge round
#: `ink`          Freestyle on/off -- the INTERNAL lines between a prop's parts
#: `ink_thickness` how heavy those lines are at 640px
#: `ink_colour`   what colour they are
#: `coat`         clearcoat added to every material: how much the surface
#:                catches a highlight, i.e. matte toy vs vinyl figure
STYLES = {
    # What is on the branch right now, so there is a baseline in the sheet
    # rather than a memory of one.
    "A-shipping": dict(
        edge_share=0.17, edge_cap=0.26, ink=True, ink_thickness=5.4,
        ink_colour=INK, coat=0.0,
    ),
    # Clash-Mini figurine: fat rounds, heavy line, matte. Everything reads as
    # a moulded piece with a thick edge.
    "B-chunky": dict(
        edge_share=0.30, edge_cap=0.42, ink=True, ink_thickness=8.0,
        ink_colour=INK, coat=0.0,
    ),
    # NO OUTLINE AT ALL, which is what the reference games actually do: Brawl
    # Stars and Clash Mini models carry no black contour, they are read by
    # form, occlusion and a strong key. The black edge was our decision, and
    # this is the version that tests whether it is the right one.
    "C-no-outline": dict(
        edge_share=0.24, edge_cap=0.34, ink=False, ink_thickness=0.0,
        ink_colour=INK, coat=0.05,
    ),
    # Illustrated: a thinner, WARMER line (the ink family at `shade`, not
    # `deep`) plus a real clearcoat, so edges catch light instead of being
    # stamped on. Reads painted rather than printed.
    "D-painted": dict(
        edge_share=0.22, edge_cap=0.32, ink=True, ink_thickness=3.4,
        ink_colour=tone("ink", "shade"), coat=0.16,
    ),
    # --- the second batch: SHADING and LIGHT, which the first four left alone
    #
    # A-D all varied the EDGE. That is a narrow axis, and it is why three of
    # them looked alike. What actually separates the reference games from this
    # is how a surface responds to light and how hard the key is, so these move
    # the shading model and the rig instead.
    #
    # TRUE CEL. ShaderToRGB into a constant-interpolation ramp: the terminator
    # becomes a hard line and the form resolves into three flat tones. This is
    # the one thing on the list that changes what "3D" even means here -- and
    # note the standing objection, that Barkly's own renders are locked canon
    # and cel-shading the world would leave the hero the odd one out. Shown
    # because it should be looked at before it is ruled out, not instead of it.
    "E-cel": dict(
        edge_share=0.20, edge_cap=0.28, ink=True, ink_thickness=5.4,
        ink_colour=INK, coat=0.0, shading="cel", bands=3,
    ),
    # VINYL FIGURE. Low roughness and a rim light behind: a real specular roll
    # down every round form and a bright edge separating it from the ground.
    "F-vinyl": dict(
        edge_share=0.20, edge_cap=0.28, ink=True, ink_thickness=4.2,
        ink_colour=INK, coat=0.35, roughness_scale=0.45, rim=3.2,
    ),
    # CLAY. The opposite: everything matte, no coat at all, and heavy contact
    # occlusion doing the separating. Soft toy rather than moulded plastic.
    "G-clay": dict(
        edge_share=0.26, edge_cap=0.36, ink=True, ink_thickness=4.6,
        ink_colour=INK, coat=0.0, roughness_scale=1.6, ao=(2.6, 1.0),
    ),
    # HIGH CONTRAST. Fill cut to a third and a rim added -- the reference's
    # actual signature is not its outline, it is that its darks are DARK and
    # its edges are lit. Closest thing here to a Brawl Stars frame.
    "H-contrast": dict(
        edge_share=0.20, edge_cap=0.28, ink=True, ink_thickness=4.6,
        ink_colour=INK, coat=0.06, fill_scale=0.35, rim=4.5, ao=(2.2, 1.0),
    ),
    # VERTICAL TONE RAMP. Every material darkens toward its own base and
    # lightens toward its top, which is the trick most stylised mobile art
    # uses to fake bounce light. Costs nothing at runtime and reads as
    # deliberate painting rather than as lighting.
    "I-toneramp": dict(
        edge_share=0.20, edge_cap=0.28, ink=True, ink_thickness=4.6,
        ink_colour=INK, coat=0.04, shading="ramp", ramp=0.30,
    ),
    # STICKER. Heavy one-weight line and the shading flattened right down, so
    # each part is close to a single fill. Vector/sticker rather than toy.
    "J-sticker": dict(
        edge_share=0.16, edge_cap=0.24, ink=True, ink_thickness=9.0,
        ink_colour=INK, coat=0.0, shading="cel", bands=2, fill_scale=1.7,
    ),
}


def _cel(mat, bands: int):
    """Quantise a material's shading into flat bands with a hard terminator.

    ShaderToRGB renders the lit surface to a colour, a CONSTANT-interpolation
    ramp snaps that to N steps, and an Emission puts it back -- the standard
    EEVEE cel setup. It only works on a rasteriser, which is the one thing this
    pack was always going to be.
    """
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    out = nt.nodes.get("Material Output")
    if bsdf is None or out is None:
        return mat
    to_rgb = nt.nodes.new("ShaderNodeShaderToRGB")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(bsdf.outputs["BSDF"], to_rgb.inputs["Shader"])
    nt.links.new(to_rgb.outputs["Color"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    ramp.color_ramp.interpolation = "CONSTANT"
    # The ramp's own stops carry the banding. Build N steps between a floor and
    # the lit value so the darkest band is still a colour and not black.
    elements = ramp.color_ramp.elements
    while len(elements) > 1:
        elements.remove(elements[-1])
    elements[0].position = 0.0
    elements[0].color = (0.42, 0.42, 0.42, 1.0)
    for i in range(1, bands):
        e = elements.new(i / bands)
        v = 0.42 + (1.18 - 0.42) * (i / (bands - 1) if bands > 1 else 1)
        e.color = (v, v, v, 1.0)
    # Multiply the banded light back onto the base colour, or every material
    # comes out grey.
    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 1.0
    mix.inputs["Color2"].default_value = bsdf.inputs["Base Color"].default_value
    nt.links.new(ramp.outputs["Color"], mix.inputs["Color1"])
    nt.links.new(mix.outputs["Color"], emit.inputs["Color"])
    return mat


def _tone_ramp(mat, amount: float):
    """Darken a material toward its own base and lighten it toward its top.

    Generated coordinates run 0..1 over the object's own bounding box, so this
    is per-object and moves with it -- the same anchoring `depth_material` uses
    for the sea. It is a painting trick, not a light: it costs nothing and it
    survives being seen from any angle.
    """
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if bsdf is None:
        return mat
    base = tuple(bsdf.inputs["Base Color"].default_value)
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    lo = tuple(max(0.0, c * (1.0 - amount)) for c in base[:3]) + (1.0,)
    hi = tuple(min(1.0, c * (1.0 + amount * 0.72)) for c in base[:3]) + (1.0,)
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = lo
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = hi
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def apply(style: dict):
    """Point the pack's own dials at this style. Module globals, no forking."""
    share, cap = style["edge_share"], style["edge_cap"]
    base_edge_for = _ORIGINAL_EDGE_FOR

    def edge_for(size, share=share, cap=cap):
        return base_edge_for(size, share, cap)

    pack._edge_for = edge_for

    # `material` is called both positionally and by keyword across the pack, so
    # the wrapper carries the real signature rather than *args.
    base_material = _ORIGINAL_MATERIAL
    floor = style["coat"]

    rough_scale = style.get("roughness_scale", 1.0)
    shading = style.get("shading", "default")

    def material_shim(name, color, roughness=0.55, metallic=0.0, coat=0.04, surface=None):
        mat = base_material(name, color, min(1.0, roughness * rough_scale), metallic,
                            max(coat, floor), surface)
        if shading == "cel":
            _cel(mat, style.get("bands", 3))
        elif shading == "ramp":
            _tone_ramp(mat, style.get("ramp", 0.25))
        return mat

    pack.material = material_shim

    # THE RIG, which the first four styles never touched. A rim behind and a
    # weaker fill is most of what a Brawl Stars frame is doing, and no amount
    # of edge work substitutes for it.
    base_setup = _ORIGINAL_SETUP

    def setup_shim(ortho_scale=5.8, target=(0, 0, 1.4), resolution=(640, 640), scene_name=""):
        camera = base_setup(ortho_scale=ortho_scale, target=target,
                            resolution=resolution, scene_name=scene_name)
        scene = bpy.context.scene
        fill_scale = style.get("fill_scale", 1.0)
        if fill_scale != 1.0:
            for obj in scene.objects:
                if obj.type == "LIGHT" and "fill" in obj.name.lower():
                    obj.data.energy *= fill_scale
        rim = style.get("rim", 0.0)
        if rim:
            bpy.ops.object.light_add(type="AREA", location=(2.4, 5.2, 5.4))
            light = bpy.context.object
            light.name = "Probe rim"
            light.data.energy = rim * 40.0
            light.data.size = 6.0
            light.data.color = pack.light_rgb("key")
            pack.look_at(light, target)
        ao = style.get("ao")
        if ao:
            scene.eevee.gtao_distance, scene.eevee.gtao_factor = ao
        return camera

    pack.setup_camera_and_lights = setup_shim

    base_use_ink = _ORIGINAL_USE_INK

    def use_ink(enabled):
        base_use_ink(enabled and style["ink"])
        if not (enabled and style["ink"]):
            return
        settings = bpy.context.view_layer.freestyle_settings
        lineset = settings.linesets[0]
        lineset.linestyle.thickness = style["ink_thickness"]
        lineset.linestyle.color = pack.rgb(style["ink_colour"])

    pack.use_ink = use_ink


_ORIGINAL_EDGE_FOR = pack._edge_for
_ORIGINAL_MATERIAL = pack.material
_ORIGINAL_USE_INK = pack.use_ink
_ORIGINAL_SETUP = pack.setup_camera_and_lights


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for style_name, style in STYLES.items():
        for path in PROPS:
            # Reset to the real pack every time, so one style cannot inherit
            # the previous one's dials.
            pack._edge_for = _ORIGINAL_EDGE_FOR
            pack.material = _ORIGINAL_MATERIAL
            pack.use_ink = _ORIGINAL_USE_INK
            pack.setup_camera_and_lights = _ORIGINAL_SETUP
            apply(style)
            builder, scale, target, _meta = pack.BUILDERS[path]
            pack.clean_scene()
            pack.setup_camera_and_lights(ortho_scale=scale, target=target,
                                         scene_name=path.split("/", 1)[0])
            pack.use_ink(pack.takes_ink(path))
            builder()
            name = f"{style_name}__{path.replace('/', '-')}.png"
            bpy.context.scene.render.filepath = str(OUT / name)
            bpy.ops.render.render(write_still=True)
            print(f"probe {name}")
    print(f"style probe wrote {len(STYLES) * len(PROPS)} renders to {OUT}")


if __name__ == "__main__":
    main()
