#!/usr/bin/env python3
"""Does every standing prop still have the cartoon proportions it was given?

`tools/blender/proportion.py` names the dials the world is drawn to. This
reads the `form` block every builder records into `assets/world/manifest.json`
and holds the props that are supposed to obey them to those numbers.

It exists because the alternative is eyeballing. The pack was re-proportioned
once, deliberately, against a reference; the next person to nudge a radius has
no way to know they have quietly put the lamp post back to a wire, and by the
time that is visible it is on a phone next to a shopfront that still obeys.

  python3 scripts/proportion.py            # report every standing prop
  python3 scripts/proportion.py --check    # exit 1 if one has drifted

WHAT IS DELIBERATELY NOT GATED, and why -- a rule that cannot be measured
honestly is worse than an absent one.

TAPER and FLARE are AUTHORING dials: `shaft()` and `flare()` pick a radius
while a builder is being written. Neither survives into the silhouette as a
ratio a band sweep can recover. A foot 55% wider than its shaft is invisible
in the bottom slice of a prop whose roots or plinth are wider still, and
measuring it anyway returned exactly 1.00 for six props that plainly do flare
-- a number that says nothing, reported as if it did. BITE is a position, not
a proportion: two parts that overlap and two that merely touch have identical
bounding boxes from outside.

So this holds the two things a silhouette profile can actually say. Nothing is
a wire, and what stands on a support is top-heavy.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools" / "blender"))
from proportion import OVERHANG, STOUT  # noqa: E402

MANIFEST = ROOT / "assets" / "world" / "manifest.json"

# The props that stand up. Ground courses, horizon bands, clouds, surf, rugs
# and the inventory items are not standing objects -- they have no support and
# no crown -- so they are exempt, and a report run prints the exemption list so
# it stays a decision rather than an unexamined default.
STANDING = (
    "park/tree",
    "park/bench",
    "park/hedge",
    "town/lamp",
    "town/planter",
    "town/fountain",
    "town/store_coral",
    "town/store_aqua",
    "town/store_violet",
    "beach/umbrella",
    "beach/palm",
    "beach/lifeguard",
    "beach/castle",
)

# And the subset that stands on a SUPPORT -- a trunk, a post, a stem, a column
# -- so what it carries can be held to OVERHANG. A bench, a hedge, a planter, a
# shopfront and a lifeguard tower are slab- or mound-shaped: the widest thing
# on them is not a crown, and the ratio between "the top" and "the middle" of a
# wall is a number with no meaning.
SUPPORTED = (
    "park/tree",
    "town/lamp",
    "town/fountain",
    "beach/umbrella",
    "beach/palm",
    "beach/castle",
)


def rules(path, form):
    """(dial, measured, floor) for one form block."""
    height, waist, crown = (form[k] for k in ("height", "waist", "crown"))
    out = [("stout", waist / height if height else 0.0, STOUT)]
    if path in SUPPORTED:
        out.append(("overhang", crown / waist if waist else 0.0, OVERHANG))
    return out


def main() -> int:
    check = "--check" in sys.argv[1:]
    if not MANIFEST.exists():
        print(f"no {MANIFEST.relative_to(ROOT)}; render and promote the pack first")
        return 1
    assets = json.loads(MANIFEST.read_text(encoding="utf-8"))["assets"]

    missing = [p for p in STANDING if "form" not in assets.get(p, {})]
    if missing:
        print("no recorded form for: " + ", ".join(missing))
        print("re-render the pack (scripts/render-world.sh) and promote it.")
        return 1

    failures = []
    if not check:
        print(f"{'prop':22} {'stout':>20} {'overhang':>20}")
    for path in STANDING:
        form = assets[path]["form"]
        cells = []
        for dial, value, floor in rules(path, form):
            if value < floor:
                failures.append((path, dial, value, floor))
            cells.append(f"{value:6.3f} / {floor:5.3f} {'ok' if value >= floor else 'LOW'}")
        while len(cells) < 2:
            cells.append("not on a support")
        if not check:
            print(f"{path:22} " + " ".join(f"{c:>20}" for c in cells))

    if not check:
        exempt = sorted(p for p in assets if "form" in assets[p] and p not in STANDING)
        print(f"\nnot standing objects, not checked ({len(exempt)}):")
        print("  " + ", ".join(exempt))

    if failures:
        print("\nPROPORTION DRIFT -- these props no longer read the way the pack does:")
        for path, dial, value, floor in failures:
            print(f"  {path} {dial} {value:.3f}, floor {floor:.3f}")
        print("\nSee tools/blender/proportion.py. Lowering a dial is not the answer:")
        print("it is shared by every prop in the game, so it would move all of them")
        print("to excuse one. Re-author the prop, or argue the exemption in words.")
        return 1
    print("\nevery standing prop still obeys the dials.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
