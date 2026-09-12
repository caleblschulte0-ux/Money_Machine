"""THE INK. One colour, one exemption list, one width rule.

Every object in this game is separated from what is behind it by a dark
contour, and that edge is decided in three different places for three good
reasons -- so the RULES about it live here, once, and all three read them.

- `scripts/promote-props.py` grows the OUTER edge off a shipped PNG's alpha.
  It has to happen there because that is the only step that knows the final
  pixel size, and an edge measured on a 640 canvas is the wrong weight on a
  224px icon.
- `world_prop_pack.py` and `home_prop_pack.py` draw the INTERNAL edges with
  Freestyle, at render time, because they are the only place that knows where
  one part of a prop stops and the next begins. An alpha dilation cannot see
  inside a silhouette.
- `world_scene_pack.py` draws BOTH with Freestyle, because a scene plate is
  opaque edge to edge and has no alpha to dilate at all.

The operator's read on the first pass, holding the contact sheet: the lamp
post and the fountain hit the target and the rest did not. Those two are
TIERED -- foot, shaft, collar, head, cap -- and every tier meets the next at a
hard geometric break in a different material, which reads as a dark line. The
tree, the hedge and the potted plant are smooth continuous masses whose lobes
melt into one blob, because the only ink they had was around the outside.
That is what this file exists to fix.

WHAT IS EXEMPT, and it is not a detail: a hard edge on a cloud, a haze, a
glow, the surf or a contact shadow is not a contour, it is a mistake. Those
are atmosphere, and atmosphere has no edge.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from palette import tone  # noqa: E402

#: IS THERE AN EDGE AT ALL? Operator, 2026-09-10: *"I don't like that art
#: style, it's too Big Nate."*
#:
#: That is the most precise note this art has had. A thick uniform black
#: contour over flat fill IS newspaper-comic language -- and it is the opposite
#: of the reference: Brawl Stars and Clash Mini models carry NO outline. Their
#: forms are read by shading, occlusion and a lit edge. The contour was our
#: invention, added in the pass that named this file, and it has been quietly
#: fighting the target ever since.
#:
#: The evidence that settled it is the hero. `assets/barkly/renders/front.png`
#: is the locked canon and has no contour; `assets/barkly/outlined/front.png`
#: is that same file with this edge grown onto it, which is what the app draws.
#: Side by side the canon render reads as a vinyl toy and the outlined copy
#: reads as a sticker. The best asset in the game was being flattened by a
#: finish applied on top of it.
#:
#: THE REASON THIS IS ONE CONSTANT and not a rewrite: the edge was always
#: decided here and applied by three consumers that all ask this module first
#: (`promote-props.py`, the prop packs' Freestyle, `outline-cast.py`). Turning
#: it off turns it off everywhere, including on the cast -- `outlined/` becomes
#: a byte-identical copy of `renders/`, so no app code changes and the canon
#: renders are untouched, exactly as they were when the contour went on.
#:
#: Flip this to True and the whole game has its edge back.
#:
#: TRUE as of the line-weight round. The operator's earlier "it's too Big
#: Nate" was a verdict on the weight and on WHERE it was, not on the idea: the
#: scene plates were carrying an ungated line at full weight (see
#: `world_scene_pack._ink_pass`) while the loose props had had theirs removed,
#: so the world was drawn with a heavy edge and inconsistently. At 1.0x the
#: line measures 4.1 pixels on a 390pt phone and Barkly's own cast contour
#: measures 4.2 -- the same hand for the dog and for the place he stands in,
#: which is the whole reason the edge exists.
CONTOUR = True

#: The colour of every edge in the game -- and it is `shade`, not `deep`.
#:
#: Operator, twice, on the live build: *"that hurts my eyes."* Pulling the
#: chroma down took a third of the frame out of the loud band and he said it
#: again, so the chroma was not the whole of it. Measured on the shipped park
#: plate, this was:
#:
#:   the line covers                       5.2% of the frame
#:   its contrast against what it borders  4.5:1
#:   within 6px of a line                  17.9% of the frame
#:   the treeline band alone                8.2% line pixels
#:
#: A fifth of the picture sitting right beside a near-black edge at 4.5:1 is
#: a grid of maximum-contrast boundaries with nowhere for an eye to rest.
#: That is a real cause of eye strain and it is a separate one from chroma.
#:
#: `deep` is value 0.16 against grass at 0.67. `shade` is 0.24 and still
#: unmistakably a dark line -- the edge stays, it stops being a hole punched
#: in the picture. `deep` is still the world's darkest neutral and is still
#: what the shadow steps are made of; it is just not what a LINE is.
INK = tone("ink", "shade")

#: The same, as 0-255 RGB, for the PIL flood in promote-props.
INK_RGB = tuple(int(INK[i:i + 2], 16) for i in (1, 3, 5))

#: Whole families that are atmosphere rather than objects.
EXEMPT_PREFIXES = ("sky/",)

#: And individual props that are, wherever they live.
EXEMPT_WORDS = ("shadow", "haze", "glow", "surf")


def contour_on() -> bool:
    """Is the drawn edge switched on? A FUNCTION, deliberately.

    `CONTOUR` is a module constant, and `from ink import CONTOUR` binds its
    VALUE at import -- a frozen copy of the switch in another module, which is
    the second source of truth this file exists to prevent, just in a shape
    that reads like an import. The scene pack did exactly that: flipping
    `ink.CONTOUR` at runtime left its copy on False, so the style probe's
    "inked storybook" and its "flat cel" rendered to a pairwise difference of
    0.0 out of 255 -- the same picture, with the line silently missing.

    Every consumer calls this instead, the way `takes_ink` is already called,
    so there is one switch and nobody holds a copy of it.
    """
    return bool(CONTOUR)


def takes_ink(path: str) -> bool:
    """Does the prop at this BUILDERS path get an edge at all?"""
    if not CONTOUR:
        return False
    if any(path.startswith(prefix) for prefix in EXEMPT_PREFIXES):
        return False
    return not any(word in path for word in EXEMPT_WORDS)


def contour_width(width: int) -> int:
    """How heavy the OUTER edge is, from the asset's own width.

    A constant pixel count would give the storefront a hairline and the treat
    icon a bruise: they ship at 640 and 224. Proportional keeps the weight even
    once the app has scaled them back into the same world.

    Zero when `CONTOUR` is off, so the one switch reaches the callers that ask
    for a WIDTH rather than for permission -- `outline-cast.py` and the item
    icons' inner box both size themselves off this.
    """
    if not CONTOUR:
        return 0
    return max(3, round(width * 0.011))
