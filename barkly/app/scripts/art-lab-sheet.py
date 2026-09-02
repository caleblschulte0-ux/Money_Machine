#!/usr/bin/env python3
"""
Tile the art-lab frames into ONE contact sheet, and measure the palette.

Two jobs. The sheet lets every scene be judged against every other scene in a
single look -- a washed-out prop set or a chrome element that only reads wrong
NEXT TO another location is invisible one screenshot at a time. The numbers
turn "it looks desaturated" into a target you can drive: the Supercell family
(Brawl Stars, Clash Mini, Squad Busters) runs high chroma with strong value
separation and very little mid-grey.
"""
import json, math, sys, colorsys
from pathlib import Path
from PIL import Image, ImageDraw

frames = Path(sys.argv[1])
out = Path(sys.argv[2])

LOCS = ["home", "park", "town", "beach"]
# All four light bands. Morning and evening were never measured, which is how
# they came to render a sunrise/sunset sky under flat noon light for a third of
# every day. Frames that were not captured are skipped, so a --bands day,night
# run still works.
BANDS = ["morning", "day", "evening", "night"]

def stats(im, skip_top_frac=0.14, skip_bottom_frac=0.22):
    """Palette stats over the WORLD only -- chrome and the dialogue panel are
    UI and would flatter the numbers."""
    w, h = im.size
    box = im.crop((0, int(h * skip_top_frac), w, int(h * (1 - skip_bottom_frac))))
    box = box.resize((box.width // 6, box.height // 6))
    sats, vals, hues = [], [], []
    for r, g, b in box.convert("RGB").getdata():
        hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        sats.append(ss); vals.append(vv); hues.append(hh)
    sats.sort(); vals.sort()
    n = len(sats)
    # Mean hue as a unit vector, so red at 0.98 and red at 0.02 average to red
    # instead of to cyan. This is the cohesion number: four locations that read
    # as four different games have four different hue centroids. Weighting each
    # sample by its own saturation is what stops a big pale sky from dragging
    # the centroid toward whatever noise its near-grey pixels happen to carry.
    hx = sum(math.cos(2 * math.pi * h) * s for h, s in zip(hues, sats))
    hy = sum(math.sin(2 * math.pi * h) * s for h, s in zip(hues, sats))
    hue = (math.atan2(hy, hx) / (2 * math.pi)) % 1.0
    strength = math.hypot(hx, hy) / max(1e-6, sum(sats))
    return {
        "mean_sat": sum(sats) / n,
        "p90_sat": sats[int(n * 0.90)],
        "mean_val": sum(vals) / n,
        "val_spread": vals[int(n * 0.95)] - vals[int(n * 0.05)],
        "washed_frac": sum(1 for s in sats if s < 0.18) / n,
        "hue": hue,
        "hue_focus": strength,
    }

report = {}
tiles = []
for band in BANDS:
    for loc in LOCS:
        f = frames / f"{loc}-{band}.png"
        if not f.exists():
            continue
        im = Image.open(f).convert("RGB")
        report[f"{loc}-{band}"] = stats(im)
        tiles.append((f"{loc} {band}", im))

if tiles:
    TW = 300
    th = int(tiles[0][1].height * (TW / tiles[0][1].width))
    cols, rows = 4, (len(tiles) + 3) // 4
    pad, label_h = 10, 22
    sheet = Image.new("RGB", (cols * (TW + pad) + pad, rows * (th + label_h + pad) + pad), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(tiles):
        c, r = i % cols, i // cols
        x = pad + c * (TW + pad)
        y = pad + r * (th + label_h + pad)
        sheet.paste(im.resize((TW, th)), (x, y + label_h))
        d.text((x + 2, y + 5), name, fill=(240, 240, 240))
    sheet.save(out / "contact-sheet.png")

motion = sorted(frames.glob("motion-*.png"))
if motion:
    MW = 220
    mh = int(Image.open(motion[0]).height * (MW / Image.open(motion[0]).width))
    strip = Image.new("RGB", (len(motion) * (MW + 6) + 6, mh + 12), (24, 24, 28))
    for i, f in enumerate(motion):
        strip.paste(Image.open(f).convert("RGB").resize((MW, mh)), (6 + i * (MW + 6), 6))
    strip.save(out / "motion-strip.png")

print(f"{'scene':14} {'sat':>6} {'p90sat':>7} {'val':>6} {'spread':>7} {'washed':>7} {'hue':>6} {'focus':>6}")
for k, v in report.items():
    print(f"{k:14} {v['mean_sat']:6.3f} {v['p90_sat']:7.3f} {v['mean_val']:6.3f} {v['val_spread']:7.3f} {v['washed_frac']*100:6.1f}% {v['hue']*360:6.0f} {v['hue_focus']:6.3f}")
(out / "palette.json").write_text(json.dumps(report, indent=2))
