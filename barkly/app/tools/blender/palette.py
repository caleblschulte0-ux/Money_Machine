"""
ONE PALETTE FOR THE WHOLE WORLD.

Measured 2026-09-09, before this file existed: the three render packs between
them named **255 distinct colours in 274 uses**. Almost every colour in the
game was chosen once, by hand, at the moment somebody wrote that prop, and
never seen next to the others. Saturation across the world ran 0.04 to 0.98
and value ran 0.18 to 1.00 -- which is not an art style, it is 255 unrelated
decisions. That is why the four places do not look like one game, and no
amount of texture, lighting or composition work reaches it.

THE REFERENCE IS BARKLY HIMSELF, because he is the thing that works. Measured
over his 106,338 opaque pixels: **95% of him sits in a 15-degree hue band**
(30-44, warm tan), saturation median 0.42, value median 0.70 with a long ramp
from 0.14 to 0.92. One hue family, a wide value range, moderate chroma. That
is the recipe, and the world now follows it.

HOW IT WORKS

  * A short list of FAMILIES. Each is one hue angle plus two dials: `chroma`,
    how saturated this material wants to be relative to the ramp, and `lift`,
    where its value range sits. Stone is the same ramp as grass with the
    chroma turned down; that is deliberate, and it is what makes a kerb and a
    lawn look like they were made by the same hand.

  * ONE RAMP, shared by every family: deep / shade / base / lit / pop. The
    saturation and value of each step are fixed here and nowhere else. A world
    reads as one game mostly because its VALUE STRUCTURE repeats -- the same
    five steps under every surface -- and that is the single thing 255
    hand-picked colours cannot have.

  * Nothing outside this file states a colour. `tests/palette_source.test.ts`
    fails on a hex literal anywhere else under tools/blender.

Change a family here and every prop, every scene and every ground plane in the
game moves with it. That is the point.
"""

import colorsys

# --- the light every surface is lit by --------------------------------
#
# One key and one ambient, for the whole world. This is the part that makes a
# lawn, a shopfront and a sandcastle look like they were photographed together
# rather than pasted together: as a surface goes into shadow it does not just
# get darker, it takes the colour of the sky, and as it catches the light it
# takes the colour of the sun. Every family gets the same two tints, so the
# blue in the grass's shadow is the same blue as in the brick's.
#
# Doing this in the palette rather than per material is the whole idea. 255
# hand-picked colours cannot share a light source, because nobody was holding
# one when they were picked.
AMBIENT = (0.17, 0.22, 0.46)   # sky-blue, what fills the shadows
KEY = (1.00, 0.94, 0.74)       # warm sun, what lands on the tops

# --- the ramp -----------------------------------------------------------
#
# Five steps, and every family gets all five: saturation, value, and how far
# the step is pushed toward AMBIENT (negative) or KEY (positive).
#
# THE FIRST VERSION OF THIS RAMP HAD NO DARKS AND THAT WAS THE WHOLE PROBLEM.
# It floored value at 0.34 on the theory that a whole scene down there reads as
# mud. Measured against the reference art the operator actually wants -- a
# Brawl Stars loading screen and card -- that theory is simply wrong:
#
#                        value p05   range   frame below 0.25   sat p95
#   Brawl Stars             0.12      0.87        18.8%          0.91
#   Barkly park             0.56      0.44         0.1%          0.67
#
# A fifth of their frame is genuinely dark. A thousandth of ours was. Our
# median sat at 0.84 where theirs sits at 0.52 -- the whole world was
# over-exposed, every surface in the top half of the range, and no amount of
# hue or texture work reaches that. A picture with no darks has no contrast,
# and contrast is what "pop" is.
#
# So the ramp spans what theirs spans. `deep` is a real dark, `pop` is a real
# highlight, and the chroma stays high through the middle because the reference
# runs sat 0.54 median with a 0.91 top end.
STEPS = {
    "deep":  (0.94, 0.16, -0.34),
    "shade": (0.88, 0.34, -0.18),
    "base":  (0.80, 0.60,  0.00),
    "lit":   (0.62, 0.82,  0.16),
    "pop":   (0.34, 0.97,  0.30),
}

# --- the families -------------------------------------------------------
#
#   hue     degrees on the wheel
#   chroma  multiplier on the ramp's saturation. 1.0 is a full-colour surface
#           (grass, paint); 0.3 is masonry; 0.2 is cream and paper.
#   lift    added to the ramp's value. Sand and cream sit high, bark and ink
#           sit low, so a family's whole ramp moves together rather than each
#           of its steps being renegotiated.
FAMILIES = {
    # The ground the game stands on. Stone and paving are deliberately far
    # from sand in chroma even though they are neighbours in hue: measured
    # after the first pass, the beach was 61% of one hue band and the town's
    # street read as more beach, because sand at 41 and paving at 44 with
    # similar chroma is the same colour twice. A street is grey and a beach is
    # gold, and the palette has to say so.
    "grass":   (100, 1.00,  0.00),
    "foliage": (132, 0.94, -0.05),
    "sand":    ( 41, 0.66,  0.09),
    "stone":   ( 28, 0.16,  0.06),
    "paving":  ( 40, 0.20,  0.12),
    # things made of wood -- Barkly's own hue family, deliberately
    "bark":    ( 24, 0.84, -0.11),
    "wood":    ( 32, 0.92, -0.02),
    # the built world
    "brick":   ( 10, 0.80,  0.02),
    "roof":    (355, 0.90, -0.02),
    "metal":   (206, 0.26,  0.02),
    # Water and air. The sea carries full chroma: it is the largest single
    # shape on the beach and at 0.88 it sat back into the sand.
    # water and air
    "sea":     (193, 1.00,  0.02),
    "sky":     (205, 0.68,  0.10),
    # the three accents, and only three
    "berry":   (348, 0.94,  0.00),
    "sun":     ( 46, 0.94,  0.06),
    "grape":   (276, 0.74,  0.00),
    # the ends of the range
    "cream":   ( 38, 0.20,  0.15),
    "ink":     ( 28, 0.30, -0.26),
}


def light_rgb(kind: str):
    """The world's two lights, as linear RGB triples for Blender lamps.

    Every render pack points its key and fill at these. Before they existed the
    prop pack lit at (1.00, 0.77, 0.58) key / (0.58, 0.78, 1.00) fill, the park
    plate at #FFE2B4 sun / #7FA8C8 sky, and the beach plate at #FFE9C4 /
    #8FC0DC -- three different suns and three different skies across art that
    is composited into the same frame. Scenes lit by different lights cannot
    look like one game no matter what colour anything is painted, and this is
    the reason the four places never matched.
    """
    if kind == "key":
        return KEY
    if kind == "fill":
        # The ambient is the colour of a SHADOW -- deep and violet, which is
        # right for the shadow side of a surface and wrong for a lamp. The
        # fill lamp is the SKY: the sky family's hue at daylight value.
        return colorsys.hsv_to_rgb(FAMILIES["sky"][0] / 360.0, 0.42, 0.94)
    raise KeyError(f"no such light: {kind!r}")


def light_hex(kind: str) -> str:
    r, g, b = light_rgb(kind)
    return "#%02X%02X%02X" % tuple(round(max(0.0, min(1.0, c)) * 255) for c in (r, g, b))


def _mix(rgb, target, amount):
    return tuple(c + (t - c) * amount for c, t in zip(rgb, target))


def tone(family: str, step: str = "base") -> str:
    """A colour from the palette, as an sRGB hex string.

    This is the ONLY place a colour comes from. `material()` takes the string
    it returns, so the render packs read as `tone("grass", "lit")` rather than
    as `"#7BDF5A"` -- which is the difference between a world with a palette
    and a world with a list of colours somebody liked.
    """
    if family not in FAMILIES:
        raise KeyError(f"no such palette family: {family!r} (have {sorted(FAMILIES)})")
    if step not in STEPS:
        raise KeyError(f"no such palette step: {step!r} (have {sorted(STEPS)})")
    hue, chroma, lift = FAMILIES[family]
    sat, val, light = STEPS[step]
    s = max(0.0, min(1.0, sat * chroma))
    v = max(0.0, min(1.0, val + lift))
    rgb = colorsys.hsv_to_rgb(hue / 360.0, s, v)
    if light < 0:
        rgb = _mix(rgb, AMBIENT, -light)
    elif light > 0:
        rgb = _mix(rgb, KEY, light)
    return "#%02X%02X%02X" % tuple(round(max(0.0, min(1.0, c)) * 255) for c in rgb)


def ramp(family: str):
    """Every step of one family, deep to pop. For gradients and scene plates."""
    return [tone(family, s) for s in ("deep", "shade", "base", "lit", "pop")]


if __name__ == "__main__":
    for name in FAMILIES:
        print(f"{name:9s} " + "  ".join(f"{s}:{tone(name, s)}" for s in STEPS))
