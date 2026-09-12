#!/usr/bin/env python3
"""r231/r232 proof: the hook interval ONLY, rebuilt in Lens Mode instead
of windowed_reveal. Does not touch build_hook() or the 74s master -- a
standalone render so nothing else in the pipeline is at risk while this
is unapproved. Run from this directory:

    python3 lens_proof_hook.py
"""
import os

import numpy as np

import graphics_layer as G
import lens_mode as L
from render_layer import OUT, encode, load_source

DUR = 8.0
FPS_ = 30


def main():
    world = load_source("hook_world")
    n = int(round(DUR * FPS_))
    out = []
    for i in range(n):
        t = i / FPS_
        img = L.hook_lens_frame(world[i], t, G.W, G.H)
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
    dst = f"{OUT}/lens_proof_hook.mp4"
    encode(out, dst, fps=FPS_)
    print(f"  wrote {dst} ({len(out)} frames)")


if __name__ == "__main__":
    main()
