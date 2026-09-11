#!/usr/bin/env python3
"""Tile a style-probe round into ONE labelled sheet, and measure each entry.

A style is judged against the OTHER styles, not on its own: sent eight
separate images an hour apart, nobody can tell whether #6 is darker than #2 or
whether they just remember it that way. `art-lab-sheet.py` does this job for
the art-lab frames, but it is wired to `<location>-<band>.png` names and reads
its inputs at import time, so it cannot be pointed at a probe round.

    python3 scripts/probe-sheet.py r2

Writes art-review/style-probe/sheet-<round>.png and prints the table.

THE NUMBERS ARE THE ONES THE OPERATOR'S COMPLAINTS NAME, and no others.
Two passes of this project were spent on invented metrics that rewarded
changes which did nothing, so each column below is here because a specific
sentence asked for it:

  flat      "completely flat green with zero variation over a huge area" --
            the value sd of the open sunlit ground, props and cast shadow
            excluded. It was 0.019 on the round-one winner.
  dark      "the world has no real darks" -- fraction of world pixels below
            value 0.25. Barkly himself is 0.254; the reference frame 0.188.
  ink       whether the contour is on, as a fraction of near-black pixels.
            Round one shipped 4.7% here while claiming the line was off.
  sat       mean saturation of the world band.
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PROBE = ROOT / "art-review" / "style-probe"
HERO = ROOT / "assets" / "barkly" / "renders" / "front.png"
SCENE_MANIFEST = ROOT / "assets" / "world" / "scenes" / "manifest.json"

# A single column of sky lifted out of a real capture. It lives in scripts/
# rather than beside the renders because `art-review/style-probe/` is
# gitignored -- renders do not belong in git -- and a tool whose input sits in
# an ignored directory works for exactly one person on exactly one machine.
#
# To refresh it after a sky change:
#   node scripts/scene-shot.mjs park /tmp/park.png 14
#   python3 -c "import numpy,PIL.Image as I; a=numpy.asarray(
#     I.open('/tmp/park.png').convert('RGB')).astype(float)[120:336,4:22
#     ].mean(axis=1); I.fromarray(a.astype('uint8')[:,None,:]).save(
#     'scripts/lib/park-sky-strip.png')"
#: A scene-probe render: `scene__<style>.png` or `r<round>__<style>.png`.
SCENE_ROUND = re.compile(r"^(scene|r\d+)__")

SKY_STRIP = ROOT / "scripts" / "lib" / "park-sky-strip.png"

#: The phone this sheet imitates: `scene-shot.mjs`'s default 390x844 viewport
#: at deviceScaleFactor 2, which is what every capture in art-review was shot
#: at. The plate is drawn UNDER the chrome, so the tile keeps the whole frame.
VIEW_W, VIEW_H = 780, 1688

#: Where the ground line and the dog sit in that frame. MEASURED ONCE off a
#: real capture (`node scripts/scene-shot.mjs park <out> 14`) rather than
#: recomputed here: the app's own chain is topPad -> insets -> stageHeight ->
#: SPRITE_FOOT -> camera.lift across three modules, and re-deriving it in a
#: Python sheet tool is exactly the second copy that goes stale. Re-measure
#: from a fresh capture if the layout moves.
GROUND_FRAC = 0.743
HERO_FRAC = 0.258


def _font(size):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def measure(im):
    a = np.asarray(im.convert("RGB")).astype(float) / 255.0
    h = a.shape[0]
    world = a[int(h * 0.10):int(h * 0.96)]
    v = world.max(axis=2)
    mn = world.min(axis=2)
    sat = np.where(v > 0, (v - mn) / np.maximum(v, 1e-6), 0.0)

    # Ground only, and only the part of it in open sun: a cast shadow is a
    # real value change and would hide exactly the flatness being measured.
    band = a[int(h * 0.66):int(h * 0.94)]
    r, g, b = band[..., 0], band[..., 1], band[..., 2]
    ground = (g > r + 0.03) & (g > b + 0.03)
    gv = band.max(axis=2)
    # CLIPPING IS A FINDING, NOT A MISSING MEASUREMENT. `2-noon` in round
    # three returned no flatness at all, and the reason was not that the
    # ground could not be found -- 78% of the band is grass -- but that it is
    # blown to pure white, so nothing ranks above the 55th percentile of
    # itself. A column that prints "n/a" there hides the very thing that
    # disqualifies the option. `>=` keeps the measurement working (a fully
    # clipped ground honestly measures as perfectly flat) and `clip` says why.
    clip = float((gv[ground] >= 0.99).mean()) if ground.sum() else 0.0
    flat = float("nan")
    if ground.sum() > 2000:
        lit = ground & (gv >= np.percentile(gv[ground], 55))
        if lit.sum() > 500:
            # COLOUR distance, not value. The first version of this column
            # measured the value sd of the lit ground and reported 0.0485 ->
            # 0.0488 across a change that is plainly visible in the crop: the
            # ground's patches vary mostly in hue and chroma at a similar
            # value, and a value-only metric cannot see them. Mean distance
            # from the lit ground's own mean colour, in RGB, does.
            px = band[lit]
            flat = float(np.linalg.norm(px - px.mean(axis=0), axis=1).mean())

    return {
        "flat": flat,
        "clip": clip,
        "dark": float((v < 0.25).mean()),
        "ink": _ink_fraction(v),
        "sat": float(sat.mean()),
    }


def _ink_fraction(v):
    """How much of the frame is DRAWN LINE, as opposed to merely dark.

    Two wrong versions of this column shipped before this one, and both said
    a render with a heavy black contour and a render with none were the same:

      * counting pixels below value 0.10 gave 16% either way. A park under a
        26-degree sun is full of genuine deep shadow, and a region of shadow
        is not a line.
      * adding a light-neighbour test but keeping the 0.12 threshold gave
        0.0% for the INKED frame and 0.2% for the clean one -- backwards --
        because the ink does not sit near black at all. Measured: v < 0.10 is
        0.50% with the contour and 0.51% without, while v < 0.16 is 6.0%
        against 3.1%. The line lives between 0.12 and 0.20.

    So a stroke is dark AT THE VALUE THE INK ACTUALLY IS, with something much
    lighter within three pixels on at least one side. Calibrated on the pair
    above, that separates them 11x: 1.23% inked against 0.11% clean.
    """
    dark = v < INK_VALUE
    if not dark.any():
        return 0.0
    pad = np.pad(v, 3, mode="edge")
    # Max of the 7x7 neighbourhood, via four shifted views -- cheap, and
    # enough to tell a stroke from a field.
    neigh = np.maximum.reduce([pad[0:-6, 3:-3], pad[6:, 3:-3],
                               pad[3:-3, 0:-6], pad[3:-3, 6:]])
    return float((dark & (neigh > v + INK_CONTRAST)).mean())


INK_VALUE, INK_CONTRAST = 0.18, 0.35


def _self_check():
    """Prove the ink column measures a LINE and not a dark AREA.

    Both earlier versions of it passed every eyeball test and were wrong in
    opposite directions, so the discriminating case runs on every invocation
    rather than living in a test nobody executes: a mid-grey field ruled with
    thin dark lines must score well above the same field carrying one large
    dark blob of the same colour.
    """
    grey = np.full((120, 120), 0.55)
    lined = grey.copy()
    lined[:, ::8] = 0.10          # 1px lines every 8px -- exactly 12.5% line
    blob = grey.copy()
    blob[30:90, 30:90] = 0.10     # one solid square -- exactly 25% dark
    line_score, blob_score = _ink_fraction(lined), _ink_fraction(blob)
    # The ruled field must come back at close to its true line fraction...
    if not 0.10 <= line_score <= 0.15:
        sys.exit(
            f"probe-sheet self-check FAILED: a field ruled 12.5% with thin "
            f"dark lines scored {line_score:.4f}; expected 0.10-0.15. The ink "
            "column is not finding strokes."
        )
    # ...and the blob must come back FAR under its 25% dark area. Its rim is
    # a real edge and is allowed to count; its interior is not.
    if not blob_score < 0.10:
        sys.exit(
            f"probe-sheet self-check FAILED: a solid dark square covering 25% "
            f"of the frame scored {blob_score:.4f}; expected well under 0.10, "
            "since only its rim is an edge. The ink column is measuring "
            "darkness, not drawn line."
        )


_self_check()


#: The closest any two of round two's options came, as a mean per-channel
#: difference over the framed tile. The operator's verdict on that round was
#: *"I can't tell the difference between them"*, so this is the number a
#: round has to BEAT, not meet.
TOO_ALIKE = 6.0


#: WHAT MAKES AN OPTION SHIPPABLE, as opposed to merely different.
#:
#: A round was once judged only on how far apart its entries were, and the
#: operator's answer was the right one: *"it has to be able to be something we
#: could actually use... give me good ones."* Distance was a necessary bar and
#: I let it become the only one, so the sheet offered a fog-washed frame, a
#: flat-cel one with the light switched off, and one raked by an 8-degree sun
#: that blew its highlights and crushed everything else. All three were
#: comfortably far from the others and none of them was a candidate.
#:
#: These are the floors an entry has to clear to be shown as a choice. They
#: are deliberately wide -- this is a "would anyone ship this" bar, not a
#: taste bar, and taste is the operator's call, not the tool's.
USABLE = {
    # Below this the frame has no darks and reads as washed out; above it the
    # picture is mostly shadow and the subject is lost.
    "dark": (0.12, 0.48),
    # Chroma. The watercolour entry came in under this with its fog on.
    "sat": (0.42, 0.70),
    # Highlights with nowhere to go. Two entries clipped a quarter of frame.
    "clip": (0.0, 0.02),
}


def _usable(labels, stats):
    """Refuse to present an option nobody would ship."""
    bad = []
    for label, st in zip(labels, stats):
        for key, (lo, hi) in USABLE.items():
            value = st[key]
            if value != value:
                continue
            if not lo <= value <= hi:
                bad.append(f"  {label}: {key} {value:.3f} outside {lo:.2f}-{hi:.2f}")
    if bad:
        print("\nNOT SHIPPABLE:")
        print("\n".join(bad))
    return bad


def _matrix(labels, thumbs):
    """Print how far apart every pair of styles is, and fail if any are twins.

    Round two shipped eight options of which five sat inside 2% of each other
    on every column -- and the columns did not catch it, because each column
    is a summary and two frames can summarise identically while looking
    different, or differ by a point and look the same. The honest measure of
    "can I tell these apart" is the distance between the PICTURES.

    Mean absolute per-channel difference over the framed tile: the same thing
    the eye integrates, in the units the renders are stored in.
    """
    arrays = [np.asarray(t.convert("RGB")).astype(float) for t in thumbs]
    print("\npairwise difference (mean per-channel, 0-255):")
    header = "".join(f"{l[:7]:>9}" for l in labels)
    print(f"{'':<12}{header}")
    worst = (1e9, "", "")
    for i, li in enumerate(labels):
        row = ""
        for j in range(len(labels)):
            if i == j:
                row += f"{'-':>9}"
                continue
            d = float(np.abs(arrays[i] - arrays[j]).mean())
            row += f"{d:>9.1f}"
            if j > i and d < worst[0]:
                worst = (d, li, labels[j])
        print(f"{li[:12]:<12}{row}")
    print(f"\nclosest pair: {worst[1]} vs {worst[2]} at {worst[0]:.1f}")
    if worst[0] < TOO_ALIKE:
        sys.exit(
            f"\nTOO ALIKE: {worst[1]} and {worst[2]} differ by {worst[0]:.1f} "
            f"of 255, under the {TOO_ALIKE} floor. Round two was shipped with "
            "options this close and the operator could not tell them apart. "
            "Move a whole art direction, not a dial."
        )


def _sky_behind(plate):
    """Put the app's real sky behind the plate's transparent top.

    A plate ships with its sky cut out -- `assets/world/scenes/park.png` is
    alpha 0 above the treeline -- because the app draws the sky, the grade and
    the clouds itself. Flattening that to RGB paints it BLACK, which is what
    the first version of this sheet did: eight tiles, each with a third of its
    height in solid black, presented as a style comparison.

    `scripts/lib/park-sky-strip.png` is a single column lifted straight out
    of a real capture, so
    the gradient behind these tiles is the one the operator is actually
    looking at rather than a guess at it.
    """
    plate = plate.convert("RGBA")
    if SKY_STRIP.exists():
        sky = Image.open(SKY_STRIP).convert("RGB").resize(
            (plate.width, plate.height), Image.BILINEAR)
    else:
        sky = Image.new("RGB", plate.size, (96, 178, 232))
    sky = sky.convert("RGBA")
    sky.alpha_composite(plate)
    return sky.convert("RGB")


def _as_the_app_shows_it(plate, scene="park"):
    """Frame the plate the way `ScenePlate` frames it, with Barkly standing in it.

    Three things were wrong with showing the raw render instead, and all three
    made the sheet argue for the wrong style:

      * the sky was black (see `_sky_behind`);
      * the whole 768x1792 plate was visible, when the app cover-scales it and
        crops most of the top and bottom away -- so half of what was being
        compared is never on screen;
      * Barkly was pasted at fifty pixels tall. He is about a QUARTER of the
        frame. A style is judged against the character who lives in it, and at
        that size he could not be judged against anything.

    The scale below is `ScenePlate.tsx`'s own formula -- the smallest scale
    that still covers the screen with the stand anchor pinned -- so this crops
    where the app crops.
    """
    if not (HERO.exists() and SCENE_MANIFEST.exists()):
        return _sky_behind(plate)
    try:
        meta = json.loads(SCENE_MANIFEST.read_text())["scenes"][scene]
        stand = meta["anchors"]["stand"]
    except (KeyError, ValueError, OSError):
        return _sky_behind(plate)

    ax = min(0.98, max(0.02, stand["x"]))
    ay = min(0.98, max(0.02, stand["y"]))
    ground = GROUND_FRAC * VIEW_H
    scale = max(VIEW_W / (2 * ax) / plate.width,
                VIEW_W / (2 * (1 - ax)) / plate.width,
                ground / ay / plate.height,
                (VIEW_H - ground) / (1 - ay) / plate.height)

    w, h = round(plate.width * scale), round(plate.height * scale)
    big = _sky_behind(plate).resize((w, h), Image.LANCZOS)
    frame = Image.new("RGB", (VIEW_W, VIEW_H), (96, 178, 232))
    frame.paste(big, (round(VIEW_W / 2 - ax * w), round(ground - ay * h)))

    hero = Image.open(HERO).convert("RGBA")
    hh = max(1, round(HERO_FRAC * VIEW_H))
    hero = hero.resize((max(1, round(hero.width * hh / hero.height)), hh), Image.LANCZOS)
    frame.paste(hero, (round(VIEW_W / 2 - hero.width / 2), round(ground - hh)), hero)
    return frame


def _spread(shots, want):
    """Pick the `want` renders that are most different FROM EACH OTHER.

    The operator's standing complaint across two rounds is the same one:
    *"I can't tell the difference between them."* A round is authored by
    guessing which dials matter, and the guesses have been wrong in a
    consistent direction -- micro-surface, band count and decimation all
    measured under the floor. Rather than guess again, this reads every
    render that exists and chooses the set with the largest minimum pairwise
    distance, so a sheet of eight is eight things somebody can actually
    choose between.

    Greedy farthest-point: start from the two furthest apart, then keep
    adding whichever candidate is furthest from everything already chosen.
    """
    thumbs = {}
    for shot in shots:
        im = Image.open(shot)
        thumbs[shot] = np.asarray(
            _as_the_app_shows_it(im).resize((96, 208), Image.LANCZOS)
        ).astype(float)
    keys = list(thumbs)
    dist = {}
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            dist[(a, b)] = dist[(b, a)] = float(np.abs(thumbs[a] - thumbs[b]).mean())
    first = max(dist, key=dist.get)
    chosen = [first[0], first[1]]
    while len(chosen) < min(want, len(keys)):
        rest = [k for k in keys if k not in chosen]
        if not rest:
            break
        chosen.append(max(rest, key=lambda k: min(dist[(k, c)] for c in chosen)))
    return sorted(chosen)


def main(argv):
    if argv and argv[0] == "--spread":
        want = int(argv[1]) if len(argv) > 1 and argv[1].isdigit() else 8
        # SCENE rounds only. This directory also holds the earlier PROP
        # probe -- a bench and a lamp on a backdrop, named `J-sticker__town
        # -lamp.png` -- and those glob identically. They are not options: a
        # prop on a plain field is the test the operator already rejected
        # ("I need more than a fucking lamp and a bench"), and being wildly
        # unlike a park they win a farthest-point search every time.
        shots = _spread(
            [s for s in sorted(PROBE.glob("*__*.png"))
             if SCENE_ROUND.match(s.name)], want)
        prefix = ""
    else:
        prefix = (argv[0] if argv else "r2").rstrip("_") + "__"
        shots = sorted(PROBE.glob(f"{prefix}*.png"))
    if not shots:
        sys.exit(f"no probe renders matching {prefix}*.png in {PROBE}")

    labels, stats, thumbs = [], [], []
    tile_w = 360
    for shot in shots:
        im = Image.open(shot)
        # MEASURE THE PLATE, COMPOSITE AFTERWARDS. Barkly is the same pixels
        # in every tile, so measuring him would drag every column toward the
        # same number and flatten exactly the differences being judged.
        stats.append(measure(im))
        labels.append(shot.stem[len(prefix):] if prefix else shot.stem.replace("__", " "))
        shown = _as_the_app_shows_it(im)
        thumbs.append(shown.resize(
            (tile_w, round(shown.height * tile_w / shown.width)), Image.LANCZOS))

    pad, cap = 14, 54
    tile_h = thumbs[0].height
    cols = min(4, len(thumbs))
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tile_w + pad) + pad,
                              rows * (tile_h + cap + pad) + pad), (22, 22, 26))
    draw = ImageDraw.Draw(sheet)
    title, small = _font(22), _font(15)

    for i, (thumb, label, st) in enumerate(zip(thumbs, labels, stats)):
        x = pad + (i % cols) * (tile_w + pad)
        y = pad + (i // cols) * (tile_h + cap + pad)
        sheet.paste(thumb, (x, y))
        draw.text((x + 2, y + tile_h + 4), label.upper(), font=title, fill=(245, 245, 240))
        flat = "n/a" if st["flat"] != st["flat"] else f"{st['flat']:.3f}"
        draw.text((x + 2, y + tile_h + 30),
                  f"flat {flat}   dark {st['dark']*100:.0f}%   "
                  f"ink {st['ink']*100:.1f}%   sat {st['sat']:.2f}"
                  + (f"   BLOWN {st['clip']*100:.0f}%" if st["clip"] > 0.05 else ""),
                  font=small,
                  fill=(235, 150, 120) if st["clip"] > 0.05 else (150, 200, 160))

    out = PROBE / (f"sheet-{prefix.rstrip('_')}.png" if prefix else "sheet-spread.png")
    sheet.save(out)
    print(f"{'style':<14}{'flat':>8}{'dark':>8}{'ink':>8}{'sat':>8}{'blown':>8}")
    for label, st in zip(labels, stats):
        flat = "n/a" if st["flat"] != st["flat"] else f"{st['flat']:.4f}"
        print(f"{label:<14}{flat:>8}{st['dark']*100:>7.1f}%"
              f"{st['ink']*100:>7.1f}%{st['sat']:>8.2f}{st['clip']*100:>7.1f}%")
    print(f"\nwrote {out}  ({sheet.width}x{sheet.height})")
    if "--matrix" in argv:
        unusable = _usable(labels, stats)
        _matrix(labels, thumbs)
        if unusable:
            sys.exit(
                f"\n{len(unusable)} option(s) above are outside the usable "
                "band. Being far from the other entries is not the same as "
                "being a candidate -- fix or drop them before presenting the "
                "round as a set of choices."
            )


if __name__ == "__main__":
    main(sys.argv[1:])
