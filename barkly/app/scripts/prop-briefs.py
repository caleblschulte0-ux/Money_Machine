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

#: What every piece shares: the canon's material and light. Scenes get only
#: this; props also get OBJECT_FRAMING. An earlier version handed the scene
#: briefs the prop framing too -- "plain light background, no scenery, no
#: ground plane" inside a brief for a whole park -- two opposite instructions
#: in one prompt.
STYLE_CORE = """Using the attached "Barkley - Concept 3" sheet as the exact style
reference -- the same flocked matte vinyl toy finish with its fine velvet nap,
the same soft studio lighting with no hard shadow, the same rounded
rectangular construction, no outlines, and the same palette family (mustard
tan / cream / charcoal) --"""

OBJECT_FRAMING = """render the object below as a SINGLE collectible toy piece from the same
set, so it looks like it was moulded in the same factory and photographed on
the same table as the dog.

Front-on, slightly above eye level, orthographic-looking (no strong
perspective), centred on a plain light background, full object in frame,
nothing cropped. No scenery, no ground plane, no other objects, no text."""

STYLE = STYLE_CORE + " " + OBJECT_FRAMING

SCENE_FRAMING = """render the PLACE below as a toy diorama playset from the same set, so the
whole scene looks moulded in the same factory as the dog and lit by the same
soft light. Chunky rounded forms, matte surfaces, no outlines, no text."""

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
    # --- the foreground strips: wide, low, seen at the bottom of every frame
    "park/near_grass": [
        "a low wall of chunky moulded grass blades, blades as fat rounded wedges, not hairs",
        "tallest blades lean left, as if a dog just ran through",
        "one clover and one dandelion puff hidden in it, small, easy to miss",
    ],
    "beach/near_sand": [
        "a soft rolling lip of sand, like a moulded dune edge seen close",
        "one clear paw print pressed into the top",
        "a single tiny cream shell half buried at one end",
    ],
    "town/near_paving": [
        "a strip of chunky rounded paving stones, each slightly different in size",
        "one stone tipped up at a corner, the kind you trip on",
        "a thin line of moss in one gap only",
    ],
    "home/near_floor": [
        "wide warm floorboards with rounded plank ends, like a toy house floor",
        "one board a shade darker than the rest, obviously replaced",
        "a single charcoal scuff mark near the middle",
    ],
    # --- the back layers: wide, far, quiet
    "park/treeline": [
        "a continuous line of soft rounded tree masses, all one muted green, no trunks visible",
        "tops scalloped at three or four different heights, never an even row",
        "one taller tree breaking the line near the right third",
    ],
    "town/rooftops": [
        "a row of chunky toy rooftops at different heights, rounded box chimneys",
        "one chimney leaning, one with a charcoal cap",
        "every roof a slightly different muted warm tone, no two the same",
    ],
    "beach/headland": [
        "one long soft rounded cliff mass running out to sea, a single muted tone",
        "a flat top with one bump where a lighthouse would be, but no lighthouse",
        "the sea-facing end rounder and lower than the land end",
    ],
    "beach/surf": [
        "a band of moulded waves, each crest a thick rounded roll of cream foam",
        "the rolls get smaller toward one end, like the tide is going out",
        "solid sculpted water, never transparent or splashy",
    ],
    "home/vista": [
        "the view through a window: two rounded green hills and one tree, like a toy diorama backdrop",
        "one hill clearly nearer and warmer than the other",
        "a single small cream cloud caught on the far hilltop",
    ],
    "sky/cloud": [
        "a chunky cloud made of three or four rounded cream lumps, flat underneath",
        "one lump much bigger than the others, off-centre",
        "moulded and solid, like a toy cloud on a stick, not wispy",
    ],
    "sky/cloud_far": [
        "a small flat-bottomed cloud, two lumps only, paler than the near cloud",
        "wider than it is tall, like it is drifting",
    ],
    # --- town
    "town/store_coral": [
        "a chunky toy shopfront, rounded box shape, wider at the base than the top",
        "a fat striped awning in coral and cream that sags a little in the middle",
        "one big round window with a charcoal frame, and a door slightly too small",
        "a sign board with no text, just a moulded bone shape",
    ],
    "town/store_aqua": [
        "a chunky toy shopfront in soft aqua, rounded box shape, slightly taller than its neighbours",
        "a scalloped cream awning and two square windows of different sizes",
        "a potted round shrub squeezed beside the door",
        "a sign board with no text, just a moulded fish shape",
    ],
    "town/store_violet": [
        "a chunky toy shopfront in muted violet, rounded box shape, leaning very slightly left",
        "a rounded arch doorway with a charcoal door and a brass knob",
        "one window with a cream flower box under it",
        "a sign board with no text, just a moulded moon shape",
    ],
    "town/paving": [
        "a wide flat plaza of large rounded paving slabs in warm stone",
        "the slabs laid in a gentle curve rather than a grid",
        "one slab with a round drain cover moulded in",
    ],
    "town/kerb": [
        "a long chunky kerb, a rounded box edge in pale stone, thick like toy blocks",
        "one section chipped at the corner",
    ],
    "town/planter": [
        "a squat square planter box, far too thick-walled, like a moulded toy part",
        "a single round shrub in it, clipped into a perfect ball",
        "one charcoal band around the planter's top edge",
    ],
    # --- beach
    "beach/lifeguard": [
        "a chunky lifeguard tower on four thick stubby legs, a rounded box hut on top",
        "a ladder with only three fat rungs, too few for the height",
        "a berry-red flag on a short pole, drooping, no wind",
    ],
    "beach/shells": [
        "a small cluster of three shells: one scallop, one spiral, one flat, all chunky",
        "the spiral one noticeably bigger than the others",
    ],
    "beach/dune_grass": [
        "a small tuft of three or four fat wedge-shaped grass blades",
        "blades bending the same way, like a steady sea breeze",
    ],
    "beach/dune": [
        "a soft rounded mound of sand, lopsided, steeper on one side",
        "a few dune grass wedges on the gentle side only",
        "a smooth moulded surface, no grain texture",
    ],
    "beach/palm": [
        "a chunky palm with a thick segmented trunk that curves in one lazy arc",
        "five fat leaf fronds, each a rounded slab, one drooping lower than the others",
        "two round coconuts tucked under the fronds",
    ],
    "beach/sand_mound": [
        "a small heap of dug sand with a scoop taken out of one side",
        "two clods rolled a little way off",
        "something charcoal and small poking out of the top, unidentifiable",
    ],
    # --- home
    "home/panelling": [
        "warm wall panelling with rounded vertical boards, like a toy house wall",
        "one board slightly shorter, leaving a gap at the top",
    ],
    "home/skirting": [
        "a chunky rounded skirting board, thick like a moulded toy part",
        "one dent in it at dog height",
    ],
    "home/rug": [
        "a round braided rug in cream and muted blue rings, seen at a slight angle",
        "one edge curled up, flipped over by a paw",
        "a small charcoal chew mark on the curled edge",
    ],
    "home/care_tray": [
        "a long low wooden tray, like a toy shelf, with three shallow rounded bays",
        "rounded corners and thick walls, clearly made to be handled",
        "one bay slightly scuffed from use",
    ],
    # --- items: tiny on screen (48px), so silhouette beats detail
    "item/treat_biscuit": [
        "a chunky bone-shaped biscuit, fat rounded ends, one end with a bite out of it",
        "golden tan, a few moulded dots on top",
    ],
    "item/treat_cheese": [
        "a thick wedge of cheese with three round holes, one hole going all the way through",
        "one corner slightly squashed",
    ],
    "item/treat_steak": [
        "a cartoon steak slab with a fat cream bone through one end",
        "thick and rounded like a toy food part, not realistic meat",
    ],
    "item/toy_rope": [
        "a short rope toy: a fat twisted body with a big round knot at each end",
        "one knot bigger than the other, the fibres at one end frayed into a tuft",
    ],
    "item/kit_bowl": [
        "a wide low dog bowl with a thick rounded rim, like a moulded toy part",
        "a charcoal rim on a cream bowl, the name area left blank",
        "a small chip out of the rim on one side",
    ],
    "item/kit_stick": [
        "a stick that is suspiciously perfect for fetch: thick, slightly bent, one short side branch",
        "chunky and rounded at both ends, bark as moulded ridges",
    ],
    "item/collar_red": [
        "a thick collar laid in a loose ring, berry red, with a brass buckle and round brass tag",
        "the same collar shape as the one on the concept sheet, just a different colour",
    ],
    "item/collar_blue": [
        "a thick collar laid in a loose ring, muted blue, with a brass buckle and round brass tag",
        "the same collar shape as the one on the concept sheet, just a different colour",
    ],
    "item/collar_green": [
        "a thick collar laid in a loose ring, muted sage green, with a brass buckle and round brass tag",
        "the same collar shape as the one on the concept sheet, just a different colour",
    ],
    "item/collar_gold": [
        "a thick collar laid in a loose ring, mustard gold, with a brass buckle and round brass tag",
        "the same collar shape as the one on the concept sheet, just a different colour",
        "slightly glossier than the others, the fancy one",
    ],
    "park/grass_tuft": [
        "a tiny tuft of four fat wedge blades, one much taller than the rest",
        "the tall blade bent over at the tip",
    ],
    "park/grass_clump": [
        "a round clump of chunky grass wedges, fuller on one side",
        "two tiny round flower heads poking out, cream and berry",
    ],
    # --- Home's furniture (its own manifest; see _sources)
    "home/chair": [
        "a squat overstuffed couch in muted berry red, arms far too fat for the seat",
        "one mustard-yellow square cushion tipped over in one corner",
        "short stubby charcoal feet, one hidden by a sagging front edge",
        "a dog-shaped dent worn into the seat on one side",
    ],
    "home/lamp": [
        "a floor lamp with a heavy round base, a thin post and a cream drum shade",
        "the shade tilted slightly, knocked and never straightened",
        "a warm glow inside the shade, the only lit thing in the room",
    ],
    "home/shelf": [
        "a chunky wall shelf unit with two open shelves and two round-knobbed drawers below",
        "two chunky books on the top shelf, one leaning on the other",
        "one drawer open a crack",
        "a small framed photo of a dog on the side, the frame slightly crooked",
    ],
    "home/window_frame": [
        "a chunky four-pane wooden window frame with a deep rounded sill, seen straight on",
        "the panes EMPTY -- solid flat magenta #FF00FF inside each pane so the game can put the outside view there",
        "a small scuffed spot on the sill where a dog rests his chin",
    ],
    "item/toy_ball": [
        "not a sphere -- very slightly squashed, as if it has been chewed",
        "one moulded seam running around it, proud of the surface",
        "a small charcoal bite dent on one side",
    ],
}


#: THE THREE SCENE PLATES. When a plate exists the app draws the WHOLE place
#: from it (ScenePlate.tsx, SCENE_PLATES) and lays only park's near grass on
#: top -- town and beach draw nothing else. So these three pictures ARE the
#: world on screen, and they come first. Their composition is not free: the
#: numbers below are read from assets/world/scenes/manifest.json, and a plate
#: that ignores them leaves Barkly floating above the ground or buried in it.
PLATES = {
    "park": [
        "a little park like a toy diorama: a soft rolling lawn, a path that curves in from the bottom and up toward the back",
        "a small bandstand with a rounded roof at the back, off to one side of the path",
        "two or three chunky trees and a clipped hedge along the back edge, one bench by the path",
        "a small mound of dug earth on the lawn to the left -- the dig spot",
    ],
    "town": [
        "a tiny town square like a toy playset: warm paving in the foreground, a row of three chunky shopfronts across the back",
        "a squat round fountain off-centre on the square",
        "two chunky street lamps: one near the left edge, one near the right edge, a little below the middle of the picture",
        "a planter box with a round shrub by one of the shops",
    ],
    "beach": [
        "a small beach like a toy diorama: golden sand in the foreground rolling down to moulded sea",
        "a soft rounded headland running out into the sea on one side",
        "a striped umbrella and a little lifeguard tower on the sand, a palm at one edge",
        "a half-finished sandcastle and a small dug hole in the sand -- the dig spot",
    ],
}

#: The sky key. The app paints its own sky (it changes with the hour), so a
#: plate's sky must be removable. Magenta is used because nothing in this
#: world's palette is magenta -- a green key would eat the trees.
SKY_KEY = "#FF00FF"


def _sources() -> dict:
    """Every piece of art the app shows, keyed `<place>/<name>`, with its file.

    Three manifests, because the art has three homes: the world props, Home's
    furniture (its own manifest -- a brief for `home/bed` existed and could
    never be emitted, because only the world manifest was read), and the
    window frame, which has no manifest at all.
    """
    world = json.loads(MANIFEST.read_text())["assets"]
    out = {k: {**v, "path": f"assets/world/{v['file']}"} for k, v in world.items()}
    home = json.loads((ROOT / "assets/world/home/props/manifest.json").read_text())["assets"]
    for k, v in home.items():
        out[f"home/{k}"] = {**v, "path": f"assets/world/home/props/{v['file']}"}
    out["home/window_frame"] = {"file": "window_frame.png", "displayWidth": 224, "anchor": "bottom",
                                "path": "assets/world/home/architecture/window_frame.png"}
    return out


#: What a player actually sees, in the order worth spending effort on. The
#: fallback group is drawn only when plates are switched off, so it is last
#: and says so -- generating it first would be effort nobody sees.
ON_TOP_OF_PLATES = {"park/near_grass", "park/grass_clump"}
FALLBACK_ONLY_PREFIXES = ("park/", "town/", "beach/")


def priority(key: str, entry: dict) -> tuple:
    if key.startswith("home/"):
        return (1, -entry.get("displayWidth", 0))
    if key in ON_TOP_OF_PLATES:
        return (2, -entry.get("displayWidth", 0))
    if key.startswith("sky/"):
        return (3, -entry.get("displayWidth", 0))
    if key.startswith("item/"):
        return (4, -entry.get("displayWidth", 0))
    return (5, -entry.get("displayWidth", 0))


def plate_brief(name: str) -> str:
    m = json.loads((ROOT / "assets/world/scenes/manifest.json").read_text())["scenes"][name]
    a = m["anchors"]
    horizon = round(a["horizon"]["y"] * 100)
    stand = round(a["stand"]["y"] * 100)
    lines = [f"### scene/{name}  ->  assets/world/scenes/{m['file']}  (THE WHOLE {name.upper()} -- do this first)", "",
             STYLE_CORE + " " + SCENE_FRAMING, "",
             "The Barkly concept sheet is the style reference only -- do NOT draw Barkly or any dog in this picture.", "",
             f"THE PLACE: the {name}.", ""]
    lines += [f"  - {q}" for q in PLATES[name]]
    lines += ["",
              "COMPOSITION -- these are measurements, not suggestions; the game places the dog by them:",
              "  - Tall portrait, 9:16.",
              f"  - The horizon line (where the ground meets the sky) sits {horizon}% down from the top.",
              f"  - Everything ABOVE the horizon is a perfectly flat, solid {SKY_KEY} magenta background: no sky, no gradient, no clouds, no sun. The game paints its own sky there.",
              f"  - The spot {stand}% down from the top, horizontally centred, is open flat ground with NOTHING on it -- that is where the dog stands. Keep a clear patch around it about a fifth of the picture wide.",
              "  - Keep everything important inside the middle three-quarters of the width; the edges get trimmed to fit phones.",
              "  - Seen from slightly above, looking straight in -- the same camera as the dog on the sheet.",
              "",
              f"Save as: raw/scene__{name}.png", ""]
    return "\n".join(lines)


def brief(key: str, entry: dict) -> str:
    quirks = QUIRKS.get(key)
    place, name = key.split("/", 1)
    subject = name.replace("_", " ")
    note = ""
    if key.startswith(FALLBACK_ONLY_PREFIXES) and key not in ON_TOP_OF_PLATES:
        note = "(Only seen when scene plates are switched off -- lowest priority.)\n\n"
    lines = [f"### {key}  ->  {entry['path']}", "", note + STYLE, "",
             f"OBJECT: a {subject} (for the {place}).", ""]
    if quirks:
        lines.append("It must have exactly these features, and nothing else added:")
        lines += [f"  - {q}" for q in quirks]
    else:
        lines.append("!! NO CHARACTER LIST YET -- do not generate this one.")
        lines.append("   Write three to five specific, slightly odd, exaggerated features into QUIRKS in")
        lines.append("   scripts/prop-briefs.py first. A prop without a list renders correctly and reads as dead.")
    lines += ["", f"Save as: raw/{place}__{name}.png", ""]
    return "\n".join(lines)


PACK = ROOT.parent / "art" / "BRIEFS.md"

PACK_HEAD = """# Barkly art briefs, in the order that matters

Generated by `python3 scripts/prop-briefs.py --pack` -- do not edit by hand;
edit `scripts/prop-briefs.py` and regenerate.

**How to use this.** Open ChatGPT (the tool that made the concept sheet).
Attach `barkly/app/assets/barkly/concept/barkly-concept.png` once at the start
of the chat. Paste one brief at a time, top to bottom, and save each image with
the exact filename it names into a folder called `raw/`. Then, from
`barkly/app`:

    python3 scripts/ingest-art.py raw/ --dry-run   # check
    python3 scripts/ingest-art.py raw/             # files them into the app

Stop after the three scenes and look at the game: they are almost everything
on screen. If a scene is wrong, regenerate that one before going further.

"""


def main() -> int:
    sources = _sources()
    if "--list-missing" in sys.argv:
        missing = [k for k in sources if not QUIRKS.get(k)]
        print(f"{len(missing)} of {len(sources)} props have no character list:")
        for k in missing:
            print(f"  {k}")
        if missing:
            print("\nWrite their lists into QUIRKS before generating them.")
        return 0
    if "--pack" in sys.argv or "--check" in sys.argv:
        order = sorted((k for k in sources if QUIRKS.get(k)), key=lambda k: priority(k, sources[k]))
        parts = [PACK_HEAD, "## 1. The three scenes (the whole world on screen)\n"]
        parts += [plate_brief(n) for n in ("park", "town", "beach")]
        groups = {1: "## 2. Home furniture", 2: "## 3. Foreground drawn over the park scene",
                  3: "## 4. Clouds", 4: "## 5. Items (store icons, 48px)",
                  5: "## 6. Fallback-only props (seen only if scene plates are off)"}
        seen = set()
        for k in order:
            g = priority(k, sources[k])[0]
            if g not in seen:
                parts.append(groups[g] + "\n"); seen.add(g)
            parts.append(brief(k, sources[k]))
        text = "\n".join(parts)
        if "--check" in sys.argv:
            # Held by __tests__/art_briefs.test.ts: every on-screen prop has a
            # character list, and the pack a person pastes from is not stale.
            missing = [k for k in sources if not QUIRKS.get(k)]
            if missing:
                print(f"{len(missing)} props have no character list: {', '.join(missing)}")
                return 1
            if not PACK.exists() or PACK.read_text() != text:
                print(f"{PACK.relative_to(ROOT.parent)} is stale -- run: python3 scripts/prop-briefs.py --pack")
                return 1
            print(f"{PACK.relative_to(ROOT.parent)} is current: 3 scenes + {len(order)} props, none missing a list")
            return 0
        PACK.parent.mkdir(parents=True, exist_ok=True)
        PACK.write_text(text)
        print(f"wrote {PACK.relative_to(ROOT.parent)}: 3 scenes + {len(order)} props, in screen-impact order")
        return 0
    wanted = [a for a in sys.argv[1:] if not a.startswith("-")]
    for key in wanted or [k for k in sources if QUIRKS.get(k)]:
        if key.startswith("scene/"):
            print(plate_brief(key.split("/", 1)[1])); continue
        if key not in sources:
            print(f"no such prop: {key}", file=sys.stderr)
            return 1
        print(brief(key, sources[key]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
