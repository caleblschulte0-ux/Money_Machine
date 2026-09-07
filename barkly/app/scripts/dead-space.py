#!/usr/bin/env python3
"""
How much of each scene is NOTHING.

The complaint this answers is "there's so much open space ... we're not using
midground, foreground, background well enough", and it was true and invisible
to every metric we had. art-lab-sheet.py measures COLOUR -- saturation, value,
hue -- and a scene can score perfectly on all of it while being a flat wall of
one lovely green with a dog in front of it. Colour says nothing about whether
the picture has anything IN it.

So this measures structure instead, two ways:

  dead      the largest single rectangle of near-uniform colour in the scene
            band, as a fraction of that band. One big empty patch is the thing
            that reads as "unfinished" -- not the total amount of grass.

  detail    the fraction of cells carrying real local contrast. A diorama with
            a proper background, midground and foreground has detail spread
            through its height; one with two tiers has it in two stripes.

  bands     detail per horizontal tenth of the scene, printed as a bar, so an
            empty midground shows up as a gap in the middle of the column
            rather than as a number you have to interpret.

Both are deliberately crude and neither is a gate. They exist so a composition
change can be argued with evidence instead of taste.

A WARNING ABOUT NIGHT, because I nearly acted on it. Night frames score
terribly here -- the Park reads 38% dead and 27% detail against 59% by day --
and that is the metric being wrong, not the art. A night sky is a large, smooth,
deliberately empty gradient, and "large smooth region" is precisely what this
measures. Chasing the number would mean lighting the sky until night stopped
looking like night. Dark frames are labelled below so the next person does not
spend an afternoon fixing a picture that is already correct.

(Checked before concluding it: the sharpest column-to-column step across the
Park's night sky is 2.0 of 255 against a median of 0.66. It is a clean gradient.
What looked like a hard compositing seam in a scaled-down contact sheet was
banding in the preview.)
"""
import sys, pathlib
from PIL import Image

# The scene band, excluding the app's own chrome: the tab row at the top and
# the care tray / composer at the bottom are not the picture.
SCENE_TOP, SCENE_BOTTOM = 0.17, 0.72
CELL = 24          # sampling grid, in cells across the frame
FLAT = 0.055       # below this local range a cell counts as empty


def cells(im):
    w, h = im.size
    top, bot = int(h * SCENE_TOP), int(h * SCENE_BOTTOM)
    band = im.crop((0, top, w, bot)).convert("RGB")
    cols = CELL
    rows = max(1, round(cols * band.height / band.width))
    small = band.resize((cols * 4, rows * 4), Image.BILINEAR)
    px = small.load()
    grid = []
    for r in range(rows):
        line = []
        for c in range(cols):
            vals = []
            for y in range(r * 4, r * 4 + 4):
                for x in range(c * 4, c * 4 + 4):
                    rr, gg, bb = px[x, y]
                    vals.append((rr + gg + bb) / 765)
            line.append(max(vals) - min(vals))
        grid.append(line)
    return grid


def largest_flat_rect(grid):
    """Largest all-flat rectangle, by the standard histogram method."""
    rows, cols = len(grid), len(grid[0])
    heights = [0] * cols
    best = 0
    for r in range(rows):
        for c in range(cols):
            heights[c] = heights[c] + 1 if grid[r][c] < FLAT else 0
        stack = []
        for c in range(cols + 1):
            cur = heights[c] if c < cols else 0
            start = c
            while stack and stack[-1][1] >= cur:
                s, hgt = stack.pop()
                best = max(best, hgt * (c - s))
                start = s
            stack.append((start, cur))
    return best / (rows * cols)


def main(frames):
    print(f"{'scene':16} {'dead':>6} {'detail':>7}  bands (top -> bottom)")
    for path in sorted(pathlib.Path(frames).glob("*.png")):
        grid = cells(Image.open(path))
        rows = len(grid)
        detail = sum(1 for line in grid for v in line if v >= FLAT) / (rows * len(grid[0]))
        dead = largest_flat_rect(grid)
        bars = ""
        for i in range(10):
            a, b = rows * i // 10, max(rows * i // 10 + 1, rows * (i + 1) // 10)
            sl = [v for line in grid[a:b] for v in line]
            frac = sum(1 for v in sl if v >= FLAT) / max(1, len(sl))
            bars += " .:-=+*#%@"[min(9, int(frac * 10))]
        # A dark frame's numbers are about the hour, not the composition.
        small = Image.open(path).convert("L").resize((40, 40))
        mean = sum(small.tobytes()) / (40 * 40 * 255)
        note = "   night: a smooth dark sky is not dead space" if mean < 0.42 else ""
        print(f"{path.stem:16} {dead:6.1%} {detail:7.1%}  {bars}{note}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "art-lab/frames")
