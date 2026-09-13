#!/usr/bin/env python3
"""Write the image-generation brief for every world prop.

WHY THIS EXISTS -- the finding that ended a long and unproductive day.

`assets/barkly/README.md` says, and has said all along:

    "The original sheet came out of ChatGPT's image generation -- the fastest
     quality upgrade is more renders in the identical style."

Barkly was made by an IMAGE MODEL. The entire world -- 49 props, 3 scene
plates -- is a Python script stacking Blender primitives. Those are two
different production pipelines, and across roughly fifteen style variants in
one session the operator rejected every single thing the second one produced
while the one asset he likes is the one asset that did not come out of it.

That is not a style bug and no parameter closes it. A script makes five
decisions about a shape; a designed object carries thousands. Everything
learned about the style still holds -- flocked matte vinyl, rounded masses, no
outline, a studio softbox, a charcoal note and a cream note, and above all a
per-prop list of specific oddities -- but those are now a BRIEF for the model
that can actually execute them, not parameters for a script that cannot.

The app does not care where a PNG came from. `assets/world/manifest.json`
states the whole contract: "modular transparent props; app owns scene
composition", each entry a file, a displayWidth and an anchor. So this is a
drop-in swap with no app changes: generate, `scripts/ingest-art.py`, done.

    python3 scripts/prop-briefs.py                  # every prop
    python3 scripts/prop-briefs.py park/tree        # one
    python3 scripts/prop-briefs.py --list-missing   # props with no list yet
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "assets" / "world" / "manifest.json"

STYLE = """Using the attached "Barkley - Concept 3" sheet as the exact style
reference -- the same flocked matte vinyl toy finish with its fine velvet nap,
the same soft studio lighting with no hard shadow, the same rounded
rectangular construction, no outlines, and the same palette family (mustard
tan / cream / charcoal) -- render the object below as a SINGLE collectible toy
piece from the same set, so it looks like it was moulded in the same factory
and photographed on the same table as the dog.

Front-on, slightly above eye level, orthographic-looking (no strong
perspective), centred on a plain light background, full object in frame,
nothing cropped. No scenery, no ground plane, no other objects, no text."""

#: THE PER-PROP CHARACTER LIST. This is the part that matters and the part a
#: renderer cannot supply. The concept sheet gives Barkly EIGHT named oddities
#: down its left edge -- rectangular head, long nose with a rounded square tip,
#: stiff bent ears that angle outward, tiny snaggletooth, striped knit-sock
#: paws, thick collar, ring-shaped tail curl, low-slung body -- and that list
#: IS his personality. A prop without one renders correctly and reads as dead;
#: the operator picked a flat outlined drawing over a perfectly-measured toy
#: tree for exactly that reason.
#:
#: Three to five each. Specific, slightly odd, exaggerated. Anything not in
#: here is listed by --list-missing rather than given filler, because inventing
#: a bullet list nobody chose is how this project got 255 unrelated colours.
QUIRKS = {
    "park/tree": [
        "fat flared foot, spreading into the ground like it is gripping it",
        "leans a little, and the canopy leans back the other way to catch itself",
        "canopy overhangs the trunk on one side like a hat brim",
        "three lobes at three different heights so the top is scalloped, never a dome",
        "one snapped-off branch stub, high up on the lean side",
    ],
    "park/bench": [
        "slats too thick for their span, like it was built by someone cautious",
        "one back slat sits slightly proud of the others",
        "stubby cast legs with a wide splayed foot",
        "worn charcoal armrest caps, rounded from use",
    ],
    "park/hedge": [
        "one continuous scalloped mass, clipped flat on top and bulging at the base",
        "a shallow dent in the top where something sat on it",
        "one stray sprig escaping the clipped line",
    ],
    "park/dig_mound": [
        "loose crumbly heap with a crescent scoop taken out of the near side",
        "three or four chunky clods thrown clear of the pile",
        "one charcoal pebble half-buried at the rim",
    ],
    "park/wildflowers": [
        "a tight clump, not a spread -- five or six stems from one base",
        "every head a different height, tallest leaning out of the clump",
        "heads are simple rounded discs, no petal detail",
    ],
    "town/bench": [],
    "town/lamp": [
        "heavy square base, far too big for the post, like a toy that must not tip",
        "post tapers and leans a couple of degrees",
        "lantern head is a rounded box with a charcoal cap and a warm cream pane",
    ],
    "town/fountain": [
        "squat wide bowl on a thick stubby plinth",
        "rim thicker on one side, as if it settled",
        "a single fat rounded water plume, moulded solid, not transparent",
    ],
    "beach/umbrella": [
        "canopy is a soft rounded dome with a scalloped edge, tilted well off vertical",
        "pole is thick and planted at an angle, sunk into a small sand cuff",
        "two panels in cream, the rest in the object colour",
    ],
    "beach/castle": [
        "three stumpy towers of clearly different heights, the tallest leaning",
        "one wall visibly slumped, like it dried wrong",
        "a charcoal shell pressed into the front wall as a door",
    ],
    "home/bed": [
        "over-stuffed bolster rim, much fatter than the mattress it surrounds",
        "one corner of the rim squashed flatter than the rest",
        "thick charcoal piping around the top edge",
    ],
    "item/toy_ball": [
        "not a sphere -- very slightly squashed, as if it has been chewed",
        "one moulded seam running around it, proud of the surface",
        "a small charcoal bite dent on one side",
    ],
}


def brief(key: str, entry: dict) -> str:
    quirks = QUIRKS.get(key)
    place, name = key.split("/", 1)
    subject = name.replace("_", " ")
    lines = [f"### {key}  ->  assets/world/{entry['file']}", "", STYLE, "",
             f"OBJECT: a {subject} (for the {place}).", ""]
    if quirks:
        lines.append("It must have exactly these features, and nothing else "
                     "added:")
        lines += [f"  - {q}" for q in quirks]
    else:
        lines.append("!! NO CHARACTER LIST YET -- do not generate this one.")
        lines.append("   Write three to five specific, slightly odd, "
                     "exaggerated features into QUIRKS in")
        lines.append("   scripts/prop-briefs.py first. A prop without a list "
                     "renders correctly and reads as dead.")
    lines += ["", f"Save as: raw/{place}__{name}.png", ""]
    return "\n".join(lines)


def main() -> int:
    assets = json.loads(MANIFEST.read_text())["assets"]
    if "--list-missing" in sys.argv:
        missing = [k for k in assets if not QUIRKS.get(k)]
        print(f"{len(missing)} of {len(assets)} props have no character list:")
        for k in missing:
            print(f"  {k}")
        print("\nWrite their lists into QUIRKS before generating them.")
        return 0
    wanted = [a for a in sys.argv[1:] if not a.startswith("-")]
    keys = wanted or [k for k in assets if QUIRKS.get(k)]
    for key in keys:
        if key not in assets:
            print(f"no such prop: {key}", file=sys.stderr)
            return 1
        print(brief(key, assets[key]))
    ready = len([k for k in assets if QUIRKS.get(k)])
    print(f"# {ready} of {len(assets)} props have a character list. "
          f"`--list-missing` shows the rest.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
