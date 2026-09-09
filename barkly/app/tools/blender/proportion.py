"""HOW A BARKLY FORM IS PROPORTIONED. The cartoon read, in one place.

The operator's note, holding a Brawl Stars screenshot next to ours: *"imagine
you took a tree from the park or a gondola from the park or one of the
storefronts, and you put it in one of those images, it would look
significantly out of place. Right? Why?"*

Two answers. The first was that nothing here had a dark contour, and that is
fixed at promotion now. This file is the second one.

Our forms were HONESTLY PROPORTIONED. A lamp post was a 0.10-radius cylinder
three units tall, which is what a lamp post is. A bench had three back slats
and three seat slats, evenly spaced, which is what a bench has. A tree trunk
tapered gently into five equal canopy balls. Measured against the reference,
every one of those is wrong in the same direction: the reference does not draw
what a thing MEASURES, it draws what a thing READS AS at thumbnail size, and
that read is always exaggerated in four specific ways.

1. OVERHANG. The mass on top is far wider than the thing carrying it. A
   lamp's lantern, a tree's canopy, an umbrella, a shop's crown -- the top
   is 2-3x the support, not 1.1x. That is what makes a silhouette read as a
   character rather than as a column.
2. TAPER. Every vertical support is much fatter at the ground than at the
   shoulder. Not the 12% `cylinder()` already gives every post -- half.
3. FLARE. And it lands on a foot wider than the shaft, so it looks planted
   instead of stuck in.
4. BITE. Parts are pushed INTO each other. A canopy that rests exactly on
   the trunk shows a seam and reads as two objects; the same canopy sunk a
   quarter of its own depth over the trunk reads as one grown thing.

And one negative rule, STOUT: nothing is a wire. A support thinner than this
share of its own prop's height disappears at the size these actually ship at
(a 190pt tree on a 390pt screen).

These are the dials, not a style guide -- `world_prop_pack.py` (town, beach,
items) and `world_scene_pack.py` (the park plate) both import them, because
the park is rendered as one composed plate with its OWN tree and bench and
those must not drift from the modular ones. `scripts/proportion.py` reads the
forms every builder records and fails the build if a prop stops obeying them.
"""

#: A crowning mass over the support under it, minimum. Two, not the three the
#: reference often reaches: this is a FLOOR the re-proportioned pack actually
#: clears at its tightest (the sandcastle, at 2.01), not an aspiration nobody
#: measured. Raising it is a decision to re-author whatever it then fails.
OVERHANG = 2.0

#: Top radius over bottom radius on a standing support. Half, not a taper.
TAPER = 0.46

#: A support's ground flare over its own shaft radius.
FLARE = 1.55

#: How far a part sinks into the one below it, as a share of its own height.
BITE = 0.26

#: Thinnest carrying section over the prop's total height. Below this it is a
#: wire. The old lamp measured 0.054 and the old umbrella 0.050; both are
#: comfortably refused now, and the tightest thing that passes is the umbrella
#: pole at 0.085.
STOUT = 0.075


def shaft(base_radius, taper=TAPER):
    """The radius a support narrows to, given what it stands on."""
    return base_radius * taper


def flare(shaft_radius, amount=FLARE):
    """The radius of the foot a support of this thickness plants on."""
    return shaft_radius * amount


def crown(support_half_width, amount=OVERHANG):
    """The half-width of the mass that belongs on top of that support."""
    return support_half_width * amount


def stack(top_z, half_height, bite=BITE):
    """Centre z for a part sitting on `top_z`, pushed DOWN into it by `bite`.

    Resting exactly (bite=0) is the seam this exists to remove.
    """
    return top_z + half_height * (1.0 - bite)
