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
import math

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
# ...and the ambient is WARM, measured off the canon rather than off physics.
#
# This was (0.17, 0.22, 0.46) -- a saturated sky blue, on the reasoning that a
# shadow outdoors is filled by the sky and therefore blue. That reasoning is
# sound for a photograph and wrong for this game, and the concept sheet says
# so in numbers. Taking the darkest 15% of each image as its shadow family:
#
#                    shadow hue      warm     blue
#   concept sheet       36 deg      98.4%     0.3%
#   Barkly alone        33 deg      99.8%     0.0%
#   park plate         200 deg       4.4%    49.0%
#
# The canon has NO blue in it. Not "less blue" -- 0.3%, which is noise. Barkly
# is a vinyl toy lit in a studio and the sheet's three swatches are Mustard
# Tan, Cream and Charcoal; there is no sky in that picture to fill anything.
#
# This hid for as long as every family ran near full chroma, because a
# saturated green in shadow is still visibly green and the blue only tinted
# it. With the field pulled back to 0.30 there is no family hue left to fight
# the mix, so the ambient simply IS the shadow colour -- and the whole world
# went grey-green the moment the chroma came down. Same root cause surfacing,
# not a new one.
#
# So the ambient is the canon's own shadow: hue 36, saturation 0.52, at a
# shadow's value. The key was already warm and stays exactly where it is; the
# warm/cool contrast that used to give form now comes from the VALUE spread in
# STEPS, which is where a three-colour palette has to get it from.
AMBIENT = (0.340, 0.269, 0.163)   # hsv(36, 0.52, 0.34) -- the canon's shadow
KEY = (1.00, 0.94, 0.74)          # warm sun, what lands on the tops

# --- and WHERE that sun stands ------------------------------------------
#
# The colour of the light was already shared and its DIRECTION was not, which
# is half a light model. Three packs each hard-coded a lamp position, so a
# bench rendered on its own could be lit at noon while the lawn it stands on
# was lit at four in the afternoon -- and it was, for exactly as long as it
# took to measure it.
#
# The number that matters is the ELEVATION, not the z. A lamp's height only
# means something next to how far out it stands, and the two packs put their
# keys at different distances (7.2 units for props, 9.0 for scenes), so the
# same z was two different suns. Angles here, z computed per rig below.
#
# WHY THESE ANGLES. A sun at 51 degrees is local noon: nearly every surface in
# an open scene faces up, so nearly every surface is lit and every cast shadow
# is a stub under the thing that casts it. That is what the whole world was,
# and it is why it held 4.9% of its pixels below value 0.25 while Barkly --
# the character standing in it, and the piece of art everything else is
# measured against -- holds 25.4%. At 26 degrees a shadow runs about twice its
# object's height and the light rakes across vertical faces instead of landing
# on their tops, which is where a picture's darks come from.
#
# Town is the exception and it earned it: its shopfronts stand along the back
# of the square, so a raking light puts the entire plaza -- the one place in
# this game the player stands and taps -- inside its own buildings' shadow.
# Measured at 26 degrees it ran median value 0.34 with a quarter of the frame
# under 0.25; at 40, 0.41 and 22.4%; at 50 it reads as a lit square.
# ONE TIME OF DAY, EVERYWHERE. Operator: *"the time of day should all be the
# same."* These were 26 / 34 / 50 / 38, each argued for on its own scene, and
# every argument was sound in isolation -- a plaza wants a higher sun than a
# field. Four defensible angles still make four times of day, and a player
# walking Home -> Park -> Town in ten seconds sees the sun jump twice.
#
# 34 is the angle the adopted style was chosen at. It keeps the long shadow
# SHAPES a low sun gives (a tree casts about 1.5x its height) without putting
# a plaza inside its own buildings' shade, which is what 26 did to town:
# measured there, median value 0.34 with a quarter of the frame under 0.25.
#
# The per-scene notes that used to live here are kept because the reasoning
# still applies to anything that moves this again: town is the one place the
# player stands and taps, so it cannot go much lower; the beach is one open
# plane and a huge sheet of water that takes the sun at the same glancing
# angle the sand does, so it cannot either; home is lit through a window,
# which is already directional.
SUN_ELEVATION = {
    "park": 34.0,
    "beach": 34.0,
    "town": 34.0,
    "home": 34.0,
    "item": 48.0,
    "sky": 48.0,
}

DEFAULT_ELEVATION = 38.0


def sun_height(reach: float, scene: str = "") -> float:
    """The z a key lamp needs, to stand at `scene`'s elevation from `reach` out.

    `reach` is the lamp's horizontal distance from the origin -- hypot(x, y) of
    wherever the rig puts it. Passing that rather than assuming one makes the
    elevation portable between packs whose lamps sit at different distances,
    which is the whole reason this lives here instead of in three files.
    """
    return reach * math.tan(math.radians(SUN_ELEVATION.get(scene, DEFAULT_ELEVATION)))

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
#
# ...but `deep` is a CREVICE value, not a surface one. The first pass put it at
# 0.16 and a park tree came back with two of its three canopy lumps reading as
# black holes -- a third of a tree is not a crevice. 0.23 keeps a real dark end
# without swallowing whole forms, and anything that wants a genuine shadow gets
# it from ambient occlusion, which is what AO is for.
#
# ...and the note above about `deep` being a CREVICE value was written when
# every family ran near full chroma, where a dark step is a dark GREEN and a
# third of a tree reading as one is a hole. It was raised 0.16 -> 0.23 for
# that, and with ADOPTED_LIFT on top the world's darkest rendered pixel sat at
# 0.30. Measured across the park plate: **0.0% of the frame below value 0.20,
# and 1.4% above 0.80** -- against 3.1% and 78.0% on the concept sheet and
# 14.3% and 26.9% on Barkly himself. The world had no darks and no lights. It
# was mid-tone from edge to edge, which is the same failure as the one-band
# saturation histogram and the same word from the operator: weak.
#
# With the field families now near-neutral, a dark step is CHARCOAL -- the
# sheet's own third swatch -- not a coloured hole, so the range can open back
# up. This widens the ramp at both ends rather than sliding it: `deep` goes
# below the sheet's darks, `pop` reaches white. The middle is untouched, so
# every surface's base colour is exactly where it was.
STEPS = {
    "deep":  (0.94, 0.13, -0.30),
    "shade": (0.88, 0.36, -0.16),
    "base":  (0.80, 0.60,  0.00),
    "lit":   (0.62, 0.86,  0.16),
    "pop":   (0.34, 1.00,  0.30),
}

# --- the families -------------------------------------------------------
#
#   hue     degrees on the wheel
#   chroma  multiplier on the ramp's saturation. 1.0 is a full-colour surface
#           (grass, paint); 0.3 is masonry; 0.2 is cream and paper.
#   lift    added to the ramp's value. Sand and cream sit high, bark and ink
#           sit low, so a family's whole ramp moves together rather than each
#           of its steps being renegotiated.
#: THE ADOPTED RAMP. The style the operator chose is this palette with its
#: ramp lifted and its chroma pulled back a touch -- lighter and airier than
#: the shipping one, which read as heavy under banded shading. Applied here,
#: once, rather than to each family by hand, so the relationships between the
#: families are exactly as authored and only the whole ramp moves.
ADOPTED_LIFT = 0.07

#: 1.00 -- and the two passes that set it to 0.90 and then 0.72 were the
#: wrong instrument, aimed at the right complaint.
#:
#: Operator, on the live build: *"that hurts my eyes,"* then *"it still just
#: looks weak,"* then *"it still just looks weird."* Three complaints, and I
#: answered all three by turning this one dial down. It is a MULTIPLIER on
#: every family at once, so it can move where the frame's chroma sits and it
#: can never change the SHAPE of the distribution. The shape was the problem.
#:
#: Measured, park plate against the approved concept sheet, as a histogram of
#: saturation rather than a mean:
#:
#:                   <.1  .1-2 .2-3 .3-4 .4-5 .5-6 .6-7 .7-8  >.8
#:   concept sheet  73.7   1.9  5.9  4.4  1.6  1.0  1.7  6.2  3.6
#:   Barkly alone    0.0   4.3 21.0 22.6  6.9  4.2  6.6 20.0 14.3
#:   park plate      6.0   4.4  9.3  2.9 12.8 64.4  0.2  0.0  0.0
#:
#: The canon is BIMODAL: three quarters of it near-neutral, then about a tenth
#: of it loud. A quiet field with accents that sing, which is what a product
#: shot of a vinyl toy is and what the sheet says in words -- "MADE TO STAND
#: OUT ON ANY SHELF."
#:
#: The park is the opposite and it is not close: **64.4% of the entire frame
#: sits in one 0.10-wide saturation band, and 0.2% of it is above 0.60.** Not
#: a loud world -- a UNIFORM one. Every shape in it competing at exactly the
#: same volume, nothing quiet, nothing singing. That is what "weak" and
#: "unrefined" measure as, and it is why more contour, better forms, a lower
#: sun and two chroma cuts all failed to touch it: none of them changes the
#: shape of that histogram, and neither does this dial.
#:
#: So the dial goes back to 1.00 and the STRUCTURE moves into the per-family
#: chroma below, where it can differ per surface. A global multiplier on top
#: of an authored spread only squeezes it flat again -- at 0.72 the accents
#: cannot reach past 0.70 no matter what they are authored at, and accents
#: that cannot get loud are the half of the canon we were missing.
ADOPTED_CHROMA = 1.00

# THE FIELD / STRUCTURE / ACCENT SPLIT.
#
# Every family used to sit near full chroma: ten of the seventeen were between
# 0.80 and 1.00, and those ten are the big surfaces -- grass, foliage, sand,
# sea, bark, wood, brick, roof. The whole world was painted at one volume by
# the things that cover the most pixels, and the five quiet families (stone,
# paving, metal, cream, ink) were all small props. That is the 64% band.
#
# The canon's split is by HOW MUCH OF THE FRAME a surface covers, so that is
# the rule here:
#
#   FIELD      the big masses -- ground, foliage, water, sky. Near-neutral.
#              These are the 74% the sheet keeps under 0.10-0.30. A field is
#              what an accent is loud AGAINST; if it has its own opinion there
#              is nothing to be loud against.
#   STRUCTURE  the built and grown world -- bark, wood, brick, roof. Mid. The
#              sheet's "Mustard Tan" lives here, and so does Barkly's own hue
#              band, deliberately: he is made of the same warm family as the
#              things he stands next to, one step louder.
#   ACCENT     berry, sun, grape -- and only those three. Full chroma, and now
#              they can actually reach it. These are a handful of pixels each
#              and they are the things the player looks at and taps.
#
# The two ends of the range are the sheet's other two swatches: `cream` is its
# Cream and `ink` is its Charcoal. They were already right.
_AUTHORED = {
    # --- FIELD ------------------------------------------------------------
    # The field also sits HIGHER than it did (lift raised on all seven), for
    # the same reason the ramp widened: the sheet's ground is a pale, airy
    # near-white at value 0.87 and ours was mud at 0.51. Structure and accent
    # keep their lifts, so the gap between a quiet high field and a darker,
    # louder object standing on it IS the contrast. Lifting everything -- which
    # is what ADOPTED_LIFT does -- cannot make that gap, only move it.
    # The ground the game stands on, and the single biggest surface in three
    # of the four locations. 1.00 -> 0.30. Nothing else in this change matters
    # as much as this line: grass alone is most of that 64% band.
    #
    # Stone and paving stay deliberately far from sand in chroma even though
    # they are neighbours in hue -- a street is grey and a beach is gold, and
    # at similar chroma they are the same colour twice. That reasoning held
    # when the numbers were higher and it still holds now they are lower.
    # ...and both greens come WARMER, 100 -> 92 and 132 -> 98. Hue survived
    # every previous pass untouched because at full chroma a blue-green canopy
    # is simply a colour choice. At 0.34 chroma and a lifted value it is MINT:
    # pale, cold, and the one note in the frame with no relative anywhere on
    # the concept sheet, whose entire range is hue 24-46. Low chroma does not
    # forgive a hue that does not belong -- it exposes it, because there is no
    # saturation left to read as deliberate. 92 and 98 are sage and olive: warm
    # greens that sit in the same family as Mustard Tan, three steps away
    # rather than across the wheel.
    "grass":   ( 92, 0.30,  0.10),
    "foliage": ( 98, 0.34,  0.04),
    # 0.18, not 0.26. The hierarchy check (scripts/art-hierarchy.py) put the
    # beach at 51.6% of its frame inside the 0.30-0.40 band -- sand is to the
    # beach what grass is to the park, the single surface that IS the picture,
    # and it was still authored as if it were one field among several.
    "sand":    ( 41, 0.18,  0.14),
    "stone":   ( 28, 0.18,  0.12),
    "paving":  ( 40, 0.22,  0.10),
    # Water and air. The sea is the largest single shape on the beach; at full
    # chroma it was a field pretending to be an accent.
    "sea":     (193, 0.44,  0.02),
    "sky":     (205, 0.26,  0.18),
    # --- STRUCTURE --------------------------------------------------------
    # things made of wood -- Barkly's own hue family, deliberately
    "bark":    ( 24, 0.46, -0.11),
    "wood":    ( 32, 0.52, -0.02),
    # the built world
    "brick":   ( 10, 0.50,  0.02),
    # 0.50, and grape 0.42 below. In TOWN the storefronts are not structure
    # standing on a field -- they ARE the field, half the frame, and the check
    # measured exactly that: 50.4% of town in one band and a chroma gap of
    # +0.109, meaning Barkly barely separated from the shops behind him. The
    # rule this file states is that chroma falls off with how much of the frame
    # a surface covers, and town is where that bites hardest. Three shops at
    # similar chroma stay obviously different because their HUES are 60 to 120
    # degrees apart; loudness was never what told them apart.
    "roof":    (355, 0.50, -0.02),
    "metal":   (206, 0.18,  0.02),
    "grape":   (276, 0.42,  0.00),
    # --- ACCENT -----------------------------------------------------------
    # TWO accents, and only two. This said "the three accents, and only three"
    # and counted `grape` among them -- but grape has exactly one consumer in
    # the entire repo, `town/store_violet`, which is a whole BUILDING. It is a
    # structure family that was carrying an accent's label, and the label was
    # the thing deciding its chroma. At 0.92 it painted the largest object in
    # town at the volume reserved for a collar stud, which is the category
    # error this whole split exists to stop. It moves up with the other
    # storefront families instead: coral is `roof` at 0.62 and aqua is `sea`
    # at 0.44, so violet at 0.56 sits between them and the three shops stay
    # tellable apart without any of them shouting.
    "berry":   (348, 1.00,  0.00),
    "sun":     ( 46, 1.00,  0.06),
    # --- the ends of the range: the sheet's Cream and Charcoal ------------
    "cream":   ( 38, 0.12,  0.15),
    "ink":     ( 28, 0.22, -0.26),
}

FAMILIES = {
    name: (hue, min(1.0, sat * ADOPTED_CHROMA), lift + ADOPTED_LIFT)
    for name, (hue, sat, lift) in _AUTHORED.items()
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
        # THE SKY YOU SEE AND THE LIGHT IT CASTS ARE NOT THE SAME COLOUR, and
        # tying them together is what kept the world grey-green. This returned
        # the `sky` family's hue at saturation 0.30 -- twice reduced, from 0.42,
        # each time because it was green-shifting the warm surfaces it filled,
        # and each time the hue was left alone as "the whole point of the fill".
        #
        # The hue WAS the point. Measured on the park plate, its shadow family
        # sits at 200 degrees -- five degrees off this lamp, so the fill lamp,
        # not the authored dark steps, is what was painting every shadow in the
        # game. Against a concept sheet whose shadows are 36 degrees and 0.3%
        # blue (see AMBIENT above), that is not a tint, it is the wrong light.
        #
        # So the fill is decoupled from the sky family: a warm near-neutral
        # bounce at the canon's hue, saturation low enough that it lifts a
        # shadow without painting it. `sky` stays blue -- it is still the
        # colour of the actual sky, which the player still sees -- but it no
        # longer decides what colour the shade side of a tree is.
        return colorsys.hsv_to_rgb(36.0 / 360.0, 0.14, 0.94)
    raise KeyError(f"no such light: {kind!r}")


#: How much of the sky a surface is actually lit by, as a multiplier on the
#: fill colour when it is used as a render WORLD.
#:
#: Both packs set `scene.world.color` to the fill colour at full strength,
#: which is a whole hemisphere of saturated blue at value 0.94 -- and that,
#: not the fill LAMP, is what washes the world. Measured on the plated town:
#: its pavement is authored #9E8C69 at saturation 0.33 and rendered #ABA38E at
#: 0.17. Blue was being added to every channel of a warm surface until half
#: its chroma was gone, and a flat ground plane takes the most of it because it
#: faces the whole sky.
#:
#: Three separate attempts to fix town by other means moved its measured
#: saturation by 0.003 in total: paving chroma up, paving lift down, sun energy
#: up and then down again. None of them could work, because none of them was
#: the thing doing it.
#:
#: Not zero: shadows take the colour of the sky, and that is the single most
#: recognisable thing about the reference art. Just not all of it.
#:
#: 0.45 -> 0.11 in the pass that lowered the sun, and the two go together. A
#: low sun cuts a long shadow and a bright hemisphere fills it straight back
#: in, so lowering one without the other buys nothing: the park plate went from
#: 4.9% of its pixels below value 0.25 to 13.8% with both, and the ambient was
#: the larger half of that. What it is NOT is an exposure change -- the key
#: energies came up at the same time (props 4.0 -> 4.7, scenes 4.2 -> 9.2) so
#: the picture gained contrast rather than just going dark.
# 0.13, from the adopted style. See the note above: this and the sun's height
# move together, and 0.13 is what the chosen look was rendered at.
SKY_FILL_STRENGTH = 0.13


def world_rgb():
    """The render world's colour: the sky, at the strength a surface sees it."""
    return tuple(c * SKY_FILL_STRENGTH for c in light_rgb("fill"))


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
