#!/usr/bin/env python3
"""Slice the supplied transparent group images into individually
stageable elements. Crops carry the source alpha; where a crop clips a
neighboring object, an erase rectangle removes the contamination."""
from PIL import Image, ImageDraw
import os

SRC = "assets_user"
OUT = "trailer/elements"
os.makedirs(OUT, exist_ok=True)

# (source, out_name, crop_box, [erase_boxes in crop coords])
CUTS = [
    # pioneers.png 1536x1024
    ("pioneers", "p_man_crate",   (80, 370, 360, 930), [(175, 0, 280, 95)]),
    ("pioneers", "p_woman_seated", (325, 395, 595, 805), [(0, 0, 45, 120), (115, 0, 270, 175)]),
    ("pioneers", "p_boy",         (595, 465, 805, 1015), [(0, 150, 112, 550), (0, 0, 62, 150)]),
    ("pioneers", "p_woman_stand", (778, 185, 968, 1015), [(0, 640, 122, 830)]),
    ("pioneers", "p_wagon_man",   (955, 30, 1536, 1015), []),
    ("pioneers", "p_fire",        (200, 640, 720, 1024), [(0, 0, 122, 285)]),
    ("pioneers", "p_ox",          (255, 225, 800, 630), [(0, 170, 235, 405), (360, 195, 545, 405)]),
    # tipis.png 1536x1024
    ("tipis", "t_man",            (148, 175, 416, 1015), []),
    ("tipis", "t_tipi_woman",     (390, 25, 1005, 1015), []),
    ("tipis", "t_tipi_family",    (888, 195, 1300, 1015), []),
    ("tipis", "t_tipi_solo",      (1308, 265, 1536, 965), []),
    # beadwork.png 1536x1024
    ("beadwork", "b_woman_stand", (5, 15, 322, 905), []),
    ("beadwork", "b_woman_seated", (328, 345, 708, 855), [(318, 0, 380, 510)]),
    ("beadwork", "b_woman_back",  (698, 395, 1105, 905), [(372, 0, 407, 510), (0, 305, 58, 510)]),
    ("beadwork", "b_pair_seated", (1165, 345, 1536, 905), [(0, 0, 48, 560)]),
]

sheet_cells = []
for src, name, box, erases in CUTS:
    im = Image.open(f"{SRC}/{src}.png").convert("RGBA").crop(box)
    if erases:
        d = ImageDraw.Draw(im)
        for e in erases:
            d.rectangle(e, fill=(0, 0, 0, 0))
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(f"{OUT}/{name}.png")
    sheet_cells.append((name, im))
    print(name, im.size)

# contact sheet for visual verification
cols = 5
cw, ch = 300, 320
rows = (len(sheet_cells) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cw, rows * ch), (42, 42, 46))
d = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(sheet_cells):
    x, y = (i % cols) * cw, (i // cols) * ch
    t = im.copy()
    t.thumbnail((cw - 16, ch - 40))
    sheet.paste(t, (x + (cw - t.width) // 2, y + 8), t)
    d.text((x + 8, y + ch - 26), name, fill=(255, 120, 120))
sheet.save("frames/elements_sheet.jpg", quality=90)
print("sheet written")
