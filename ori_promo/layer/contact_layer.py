#!/usr/bin/env python3
"""r226 evidence pack: full-film contact sheet for v37 "The World / The
Layer", after closing the residual vignette-edge gap ChatGPT's r225 code
audit found (confirmed by direct calculation, not taken on its word):
windowed_reveal()'s vignette denominator left ~8.3% ramp (~5% alpha)
still showing at the crop rectangle's own left/right/top/bottom
midpoints, a small but real contradiction of r220's "no hard edge" claim.
graphics_layer.py's divisor changed from 0.6 to 0.55 (1 - the 0.45
inset) so the ramp reaches exactly 0 at the rectangle boundary instead
of short of it -- verified against a standalone numpy reproduction
before touching the render (residual dropped from ~5.3% to ~0.3% at the
four cardinal edge points; center/interior look, at 60% peak alpha, is
untouched).

r220's own header, unchanged below: after r216-r219 confirmed, with
direct evidence, that true pixel-locked "same camera, different era"
photo editing is not achievable by any tool available to either agent
(ChatGPT's generator re-composes instead of editing in place; classical
CV inpainting smears unusably at this scale), the operator's direct
instruction: "you and ChatGPT are two of the smartest things on this
planet, figure it out... you're gonna have better ideas than I will."

The structural pivot: every round back to r196 tried to make a SOLID,
opaque, hard-edged rectangular photo insert read as if it belonged in
the real photo -- sharper crop, matched color, even attempting to
erase the real railing to match pixel-for-pixel. All of that fights
the same losing battle, because a fully opaque rectangle of different
pixels always reads as "a photo taped on," regardless of how well
graded -- and because real AR glasses don't show solid photographs in
the first place, they show a translucent HUD you see the world
through. windowed_reveal() now composites an elliptical, genuinely
translucent (~60% peak alpha) vignette instead of a rectangle at
90%-capped opacity -- an organic hologram with no hard edge or corner
for the real scene to have to line up against, replacing the alignment
problem instead of re-solving it.
Same density/EXTRA_BOUNDS as r193/r195/r197/r199/r201/r203/r208/r211/r213/r214/r215/r220.
"""
import subprocess

import cv2
import numpy as np

W, H = 1920, 1080
MASTER = "../out/ORI_WorldLayer_r226_final_master.mp4"
SECTION_BOUNDS = [0.0, 8.0, 20.0, 32.0, 40.0, 49.5, 54.0, 66.0, 74.0]
EXTRA_BOUNDS = [
    1.8, 4.2,                                  # hook: layer starts / fully revealed
    5.6, 7.0,                                  # hook: disclosure over pale sky/snow (r190)
    3.5, 4.5, 5.0, 6.0, 6.5,                    # r203: the gesture window itself
                                                 # (raw IMG_6790 t~3.5-7.0s, local
                                                 # t = raw - 0.5s new in-point)
    9.5, 12.2, 15.0, 19.0, 20.0,                # borrow: hardware in/hold, software swap, software out
    19.2, 19.4, 19.6, 19.8,                     # r201: ChatGPT's exact 6 requested
                                                 # boundary-check timestamps for the
                                                 # bracket-geometry close fix
    16.8, 18.2,                                 # borrow: disclosure over bright hair/sky (r190)
    20.0, 20.2, 21.0, 21.9,                     # recognize: label entry / full 72px hold / exit (r186)
    21.8, 23.0, 24.6,                           # recognize: zone-trace in, anchor-pulse in, captions
    22.8, 24.0, 30.8,                           # recognize: captions over bright grass/concrete (r190)
    33.0, 36.0, 40.0,                           # examples: historical disclosure in, hold, part boundary
                                                 # (IMG_DAK1.MOV is exactly 8.0s -- hist is 32.0-40.0, not
                                                 # 32.0-40.5; ice absorbs the other 0.5s below)
    33.6, 39.2,                                  # examples: historical disclosure/caption vs river rock (r190)
    41.0, 44.5, 49.5,                           # examples: ice disclosure in, hold, part boundary
    42.8, 49.0,                                  # examples: ice disclosure over pale sky/snow (r190)
    50.5, 52.0,                                 # examples: audio (no disclosure) reset + pulse
    49.6, 49.7, 51.0, 53.0, 53.9,                # r208: push-in start/mid/end samples across
                                                 # examples_audio's own new continuous zoom
    54.5, 57.0, 60.0, 63.0, 65.5,                # loop: word beats + push-in start/end samples (r193)
    66.0, 69.2,                                  # close: definition caption over sunlit concrete (r190)
    70.5, 70.6, 73.9,                            # close: end card appears / literal final frame
]


def grab(t):
    t = min(max(t, 0.0), 73.9)
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", MASTER,
                        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                       capture_output=True).stdout
    if len(p) < W * H * 3:
        raise SystemExit(f"no frame at {t}s")
    return np.frombuffer(p[:W * H * 3], np.uint8).reshape(H, W, 3).copy()


def stamp(f, t):
    f = f.copy()
    cv2.rectangle(f, (0, H - 46), (150, H), (0, 0, 0), -1)
    cv2.putText(f, f"{t:5.1f}s", (8, H - 12), cv2.FONT_HERSHEY_SIMPLEX,
                0.85, (255, 255, 255), 2)
    return f


def main():
    times = sorted(set([round(x, 2) for x in
                         list(np.arange(0.0, 74.0, 1.4)) + SECTION_BOUNDS + EXTRA_BOUNDS]))
    tile_w, tile_h = 384, 216
    cols = 10
    rows = (len(times) + cols - 1) // cols
    sheet = np.zeros((rows * tile_h, cols * tile_w, 3), np.uint8)
    for i, t in enumerate(times):
        f = cv2.resize(stamp(grab(t), t), (tile_w, tile_h))
        r, c = divmod(i, cols)
        sheet[r * tile_h:(r + 1) * tile_h, c * tile_w:(c + 1) * tile_w] = f
    cv2.imwrite("r226__claude__v37_vignette_edge_fix__contact.png", sheet)
    print(f"  contact sheet: {len(times)} frames, {cols}x{rows}")


if __name__ == "__main__":
    main()
