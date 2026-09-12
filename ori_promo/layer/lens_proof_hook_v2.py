#!/usr/bin/env python3
"""r239/r240 proof: the hook interval using the direct-edit real photo
(ChatGPT edited the actual captured frame, not a standalone generation)
instead of the hand-drawn vector silhouette. Freezes on the exact real
moment during the reveal window and cross-dissolves original <-> edited
-- two versions of the SAME photograph, so there is no second image with
different geometry to fail to line up. Standalone: does not touch
build_hook() or the 74s master. Run from this directory:

    python3 lens_proof_hook_v2.py
"""
import os

import numpy as np
from PIL import Image

import graphics_layer as G
import lens_mode as L
from render_layer import OUT, encode, load_source

DUR = 8.0
FPS_ = 30

EDITED_PATH = "../ai/iceage/hook_mammoths_direct_edit_r239_chatgpt.jpg"


def _load_edited_bgr(w, h):
    im = Image.open(EDITED_PATH).convert("RGB")
    if im.size != (w, h):
        im = im.resize((w, h), Image.LANCZOS)
    arr = np.array(im).astype(np.float32)
    return arr[:, :, ::-1]  # RGB -> BGR


def main():
    world = load_source("hook_world")
    n = int(round(DUR * FPS_))
    edited_bgr = _load_edited_bgr(G.W, G.H)
    original_bgr = world[int(round(4.0 * FPS_))]

    out = []
    for i in range(n):
        t = i / FPS_
        frozen = L.real_edit_reveal_frame(world[i], t, original_bgr, edited_bgr)
        if frozen is not None:
            img = frozen
        else:
            img = G.full_bleed(world[i])
        if t <= 1.9:
            k = G.fade_k(t, 1.9, in_t=0.4, out_margin=0.5)
            G.primary_label(img, "THE WORLD", k=k, y_frac=0.14)
        else:
            k = G.fade_k(t - 1.9, DUR - 1.9, in_t=0.4, out_margin=0.4)
            G.primary_label(img, "THE LAYER", k=k, y_frac=0.14)
        if t >= 1.8:
            G.disclosure(img, "VISUALIZATION", corner="tr")
        out.append(np.array(img.convert("RGB"))[:, :, ::-1].astype(np.float32))
    os.makedirs(OUT, exist_ok=True)
    dst = f"{OUT}/lens_proof_hook_v2.mp4"
    encode(out, dst, fps=FPS_)
    print(f"  wrote {dst} ({len(out)} frames)")


if __name__ == "__main__":
    main()
