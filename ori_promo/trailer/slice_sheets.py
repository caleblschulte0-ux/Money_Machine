#!/usr/bin/env python3
"""Slice the supplied transparent asset sheets into individual objects.
Each crop is a whole isolated object on the sheet — no group surgery."""
from PIL import Image, ImageDraw
import glob
import os

U = "/root/.claude/uploads/be5af791-3d77-56ef-9944-8170866e1297"
OUT = "trailer/assets_v3"
os.makedirs(OUT, exist_ok=True)


def sheet(fid):
    return Image.open(glob.glob(f"{U}/{fid}-*.png")[0]).convert("RGBA")


# sheetC (0ff46fad, 1536x1024): the primary individual-asset set
C = sheet("0ff46fad")
# sheetA (877d1212): includes the photoreal glasses hero
A = sheet("877d1212")

CUTS = [
    (C, "wagon",        (0, 5, 425, 300), []),
    (C, "oxen",         (400, 90, 762, 300), []),
    (C, "settler_man",  (742, 8, 885, 300), [(0, 85, 18, 152)]),
    (C, "settler_woman", (888, 18, 1045, 298), [(0, 55, 15, 118)]),
    (C, "settler_boy",  (1068, 92, 1152, 288), []),
    (C, "campfire",     (1288, 862, 1524, 1020), []),
    (C, "tipi_big",     (0, 325, 292, 598), []),
    (C, "tipi_trio",    (292, 408, 594, 594), []),
    (C, "dakota_man",   (615, 288, 795, 600), []),
    (C, "dakota_woman", (798, 305, 962, 598), [(148, 148, 164, 295)]),
    (C, "dakota_crouch", (952, 440, 1125, 602), [(158, 0, 173, 62)]),
    (C, "dakota_rider", (1095, 285, 1275, 604), []),
    (C, "mammoth",      (0, 588, 595, 892), [(528, 0, 595, 172), (0, 0, 62, 22)]),
    (C, "sabertooth",   (528, 636, 958, 882), [(0, 140, 62, 246)]),
    (A, "glasses_hero", (1178, 878, 1536, 1024), [(0, 0, 28, 146)]),
]

cells = []
for src, name, box, erases in CUTS:
    im = src.crop(box)
    if erases:
        dd = ImageDraw.Draw(im)
        for e in erases:
            dd.rectangle(e, fill=(0, 0, 0, 0))
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(f"{OUT}/{name}.png")
    cells.append((name, im))
    print(name, im.size)

cols = 5
cw, ch = 300, 320
rows = (len(cells) + cols - 1) // cols
sheet_img = Image.new("RGB", (cols * cw, rows * ch), (44, 44, 48))
d = ImageDraw.Draw(sheet_img)
for i, (name, im) in enumerate(cells):
    x, y = (i % cols) * cw, (i // cols) * ch
    t = im.copy()
    t.thumbnail((cw - 16, ch - 40))
    sheet_img.paste(t, (x + (cw - t.width) // 2, y + 8), t)
    d.text((x + 8, y + ch - 26), name, fill=(255, 120, 120))
sheet_img.save("frames/assets_v3_sheet.jpg", quality=90)
print("sheet written")
