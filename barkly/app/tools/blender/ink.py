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

#: The world's darkest neutral, and the only colour any edge in the game is.
INK = tone("ink", "deep")

#: The same, as 0-255 RGB, for the PIL flood in promote-props.
INK_RGB = tuple(int(INK[i:i + 2], 16) for i in (1, 3, 5))

#: Whole families that are atmosphere rather than objects.
EXEMPT_PREFIXES = ("sky/",)

#: And individual props that are, wherever they live.
EXEMPT_WORDS = ("shadow", "haze", "glow", "surf")


def takes_ink(path: str) -> bool:
    """Does the prop at this BUILDERS path get an edge at all?"""
    if any(path.startswith(prefix) for prefix in EXEMPT_PREFIXES):
        return False
    return not any(word in path for word in EXEMPT_WORDS)


def contour_width(width: int) -> int:
    """How heavy the OUTER edge is, from the asset's own width.

    A constant pixel count would give the storefront a hairline and the treat
    icon a bruise: they ship at 640 and 224. Proportional keeps the weight even
    once the app has scaled them back into the same world.
    """
    return max(3, round(width * 0.011))
