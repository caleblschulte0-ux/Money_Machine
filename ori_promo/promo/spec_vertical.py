"""ORI promo -- the 9:16 SOCIAL cut, from the same timeline as spec.py.

Same shots, same durations, same narration and mix. Every real shot is
reframed to portrait by cropping a 1080-wide window from the full-height
source, centred on the subject (vx = fraction of the source width); the
turntable is fitted to the width on a blurred copy of its own studio
grey; the map renders natively portrait; the end card is native.
"""
import os
from spec import *                       # noqa: F401,F403  (everything not overridden below)
import spec as _L

W, H, BAR = 1080, 1920, 0
WORK = "work_v"
OUT_NAME = "ORI_promo_vertical.mp4"

_SCALED_W = round(1920 * H / 1080)       # the source, scaled to the full height


def _x0(vx):
    return int(min(max(0, vx * _SCALED_W - W / 2), _SCALED_W - W))


def V(x, y, vx):
    """A landscape (1920x1080) frame point -> this cut's frame, for a shot cropped at vx."""
    k = H / 1080
    return (int(round(x * k - _x0(vx))), int(round(y * k)))


def V_fit(x, y):
    """Same, for the fit-to-width turntable (letterboxed inside the portrait frame)."""
    k = W / 1920
    return (int(round(x * k)), int(round(y * k + (H - 1080 * k) / 2)))


# per-shot crop centre (fraction of the source width) and the moves re-aimed
VX = {"pan": 0.50, "falls": 0.50, "reading": 0.42, "worn": 0.25, "markers": 0.62, "mammoth": 0.21,
      "dakota": 0.66, "point": 0.62, "sync": 0.50, "bridge": 0.50, "close": 0.50}

SHOTS = []
for sid, src, t_in, dur, opt in _L.SHOTS:
    o = dict(opt)
    if sid in VX:
        o["vx"] = VX[sid]
    if sid == "plaque":
        src = "work/plaque_still_v.png"         # the portrait frame itself
    if sid == "glasses":
        o["fit"] = "width"
        o["push"] = (0.78, 2.2, V_fit(1350, 470))
    if sid == "worn":
        o["pull"] = (0.4, 2.0, V(480, 600, VX["worn"]))
    SHOTS.append((sid, src, t_in, dur, o))

EYEBROWS = [(1.6, 4.1, "OPEN RANGE  ·  AR GLASSES  ·  FALLS PARK, SD")]

_mvx, _dvx, _kvx, _pvx = VX["mammoth"], VX["dakota"], VX["markers"], VX["point"]
FX = {
    "markers": dict(exclude_x=V(1200, 0, _kvx)[0], reticle=V(1290, 500, _kvx), mill=V(1150, 470, _kvx),
                    falls=V(1395, 520, _kvx), mill_side=1, falls_side=-1, mill_rise=215, falls_rise=80),
    "safety": dict(anchor=V(1000, 640, _pvx), side=1),      # the water is left of him in this crop
    # on the rock bank below the mill (the crop moves left to hold the bank and the falls)
    "mammoth": dict(anchor=V(335, 752, _mvx), scale=0.58 * H / 1080, exclude=(0, 0, 1, 1),
                    water_poly=[V(x, y, _mvx) for x, y in [(0, 775), (560, 770), (980, 800), (980, 1080), (0, 1080)]]),
    "dakota": dict(anchor=V(1275, 760, _dvx), scale=0.78 * H / 1080, exclude=(0, 0, 1, 1)),
}
