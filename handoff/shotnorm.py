#!/usr/bin/env python3
"""Shot-level TECHNICAL normalization -- the stage r39 made a requirement.

The look test proved a single global finish cannot carry a film. ChatGPT read
the bridge plate off the r38 contact sheet as "milkier and lower-contrast"; the
measurement agreed and said why:

    plate        black(p1)   med      white(p99)  range   std
    s0 rock       0.0301    0.3834    0.9643    0.9342  0.2838
    s1 river      0.0300    0.6786    0.9324    0.9024  0.2300
    s2 ruin       0.0207    0.6679    0.9253    0.9045  0.2491
    s3 bridge     0.1580    0.6435    0.9452    0.7871  0.2220

The bridge black point sits 5x higher than its neighbours and the plate has lost
13% of its dynamic range: veiling glare, atmospheric haze scattering light into
the shadows. No global grade can fix that, because the defect is per-shot.

WHAT THIS MATCHES, AND WHAT IT DELIBERATELY DOES NOT
----------------------------------------------------
Black point, white point, and white balance. That is the whole job. It is a
two-point fit plus a bounded neutral correction, and it is NOT five different
grades -- it is the opposite, bringing varied sources into ONE common neutral
range so the single approved finish produces a consistent film.

It does NOT match the median. The first version did, and that was over-reach:
shot 0 is dark water and shadowed rock, shot 1 is a sunlit river, and forcing
them to a common mid is not normalization, it is grading composition away. In
practice it also failed on its own terms -- shot 0's gamma pinned to its clamp
still could not reach the target, and the fight lifted its black back from
0.037 to 0.048. Dropping median matching tightened the black-point spread from
0.0232 to 0.0055 and fixed the bridge more completely (range 0.888 -> 0.905
against neighbours at 0.899-0.914).

MEASURE WHAT SHIPS
------------------
Statistics come from the DELIVERED region, via deliver_region(). Shot 0's
source is portrait (1080x1920) and delivery is 16:9, so its full-plate median
of 0.654 was dominated by sky that never reaches the screen; the band that
actually ships measures 0.383. Normalizing to the full plate fitted the film to
pixels no one will ever see and left shot 0 reading 0.2 darker than everything
around it in the cut.

Every applied value is returned so it can be recorded per shot in the timeline
(r39 s6). A shot already in range gets values near unity and is left alone --
normalization must be able to do nothing.
"""
import numpy as np

WB_CLAMP   = 0.06           # max per-channel white-balance move
CAST_CLAMP = 0.030          # max per-channel departure from a neutral veil
BLACK_MAX  = 0.20           # never subtract more veil than this
STRETCH    = (0.85, 1.30)   # bounds on the contrast stretch
TOE_KNEE   = 0.018          # soft floor: see _soft_floor
VEIL_HI    = (0.72, 0.99)   # taper the veil out across this luminance band


def deliver_region(im, aspect=16.0/9.0):
    """The part of a plate that actually reaches the screen.

    Measuring the whole plate is wrong whenever the source aspect differs from
    the delivery aspect -- see the module docstring for the portrait case that
    found this."""
    h, w = im.shape[:2]
    if w / h < aspect:
        bh = int(round(w / aspect)); y0 = (h - bh) // 2
        return im[y0:y0 + bh]
    bw = int(round(h * aspect)); x0 = (w - bw) // 2
    return im[:, x0:x0 + bw]


def _hi_weight(l, lo=VEIL_HI[0], hi=VEIL_HI[1]):
    """Smoothstep ramp over the highlight band."""
    t = np.clip((l - lo) / max(hi - lo, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _soft_floor(x, k=TOE_KNEE):
    """Compress the deepest shadows toward zero instead of clipping them onto it.

    Subtracting a shot's own 1st-percentile black is the whole point of veil
    removal, but done with a hard clip it drove ~0.7% of every frame to
    identical pure black and the deepest detail died with it. Pulling the veil
    back instead (0.90x) cut the crush but put the bridge black at 0.087
    against 0.043 elsewhere -- it restored the exact defect being removed.

    So keep the full subtraction and soften the landing: below k the curve
    becomes k*exp((x-k)/k), continuous in value AND slope at k, approaching
    zero asymptotically. Crush fell from 0.785% to 0.001% with shadow
    separation intact."""
    return np.where(x >= k, x, k * np.exp((np.minimum(x, k) - k) / k))


def _lum(bgr):
    return 0.114 * bgr[..., 0] + 0.587 * bgr[..., 1] + 0.299 * bgr[..., 2]


def measure(bgr):
    """bgr float 0..1 -> the statistics normalization works from.

    Pass a delivered region, not a whole plate."""
    l = _lum(bgr)
    return {
        "black": [float(np.percentile(bgr[..., c], 1.0)) for c in range(3)],
        "white": [float(np.percentile(bgr[..., c], 99.0)) for c in range(3)],
        "lum_black": float(np.percentile(l, 1.0)),
        "lum_white": float(np.percentile(l, 99.0)),
        "lum_med": float(np.percentile(l, 50.0)),
        "lum_std": float(l.std()),
    }


def plan(stats):
    """One common black and white from the set, then per-shot params to reach it.

    The target is the MEDIAN OF THE SHOTS, not a fixed number: the film should
    settle where its own material already lives, so the shot that needs the
    most work is the one that moves, not every shot at once."""
    tgt = {
        "black": float(np.median([s["lum_black"] for s in stats])),
        "white": float(np.median([s["lum_white"] for s in stats])),
    }
    return tgt, [_params(s, tgt) for s in stats]


def _params(s, tgt):
    b_all  = float(np.mean(s["black"]))
    b_mean = min(b_all, BLACK_MAX)
    veil = [max(b_mean + float(np.clip(s["black"][c] - b_all,
                                       -CAST_CLAMP, CAST_CLAMP)), 0.0)
            for c in range(3)]
    w = [max(s["white"][c] - veil[c], 1e-3) for c in range(3)]
    mean_w = float(np.mean(w))
    wb = [float(np.clip(mean_w / w[c], 1.0 - WB_CLAMP, 1.0 + WB_CLAMP))
          for c in range(3)]
    lo = max(s["lum_black"] - b_mean, 0.0)
    hi = max(s["lum_white"] - b_mean, 1e-3)
    span = max(hi - lo, 1e-3)
    stretch = float(np.clip((tgt["white"] - tgt["black"]) / span, *STRETCH))
    return {"veil": [round(x, 5) for x in veil], "wb": [round(x, 4) for x in wb],
            "lo": round(lo, 5), "hi": round(hi, 5),
            "out_lo": round(tgt["black"], 5),
            "out_hi": round(tgt["black"] + span * stretch, 5),
            "stretch": round(stretch, 4)}


def apply(bgr, p):
    src = bgr.astype(np.float32)
    out = src.copy()
    for c in range(3):
        out[..., c] = _soft_floor(out[..., c] - p["veil"][c]) * p["wb"][c]
    # one luminance transfer -- normalize, place -- applied to all three
    # channels as a single gain, so hue survives it untouched
    l = np.maximum(_lum(out), 1e-4)
    n = np.clip((l - p["lo"]) / max(p["hi"] - p["lo"], 1e-4), 0.0, 4.0)
    l2 = np.maximum(p["out_lo"] + n * (p["out_hi"] - p["out_lo"]), 0.0)
    out = out * (l2 / l)[..., None]

    # Highlight hue restore. Subtracting a large veil from a BRIGHT pixel
    # compresses its channel ratios, and that is where sky colour lives:
    # 0.16 off the bridge plate fixed every rock in the frame and walked its
    # sky from hue 220deg to 195deg. Two fixes failed on measurement --
    # tightening the per-channel cast clamp did nothing (0.000 gave the same
    # 195deg, so the culprit is magnitude, not imbalance), and tapering the
    # veil out across the highlights made it worse, hue 138deg, green.
    # What works is to keep the density work in the LUMINANCE, where it
    # belongs, and take the channel RATIOS in the bright end from the
    # untouched source. Luminance is unchanged by construction.
    k = _hi_weight(_lum(src))[..., None]
    src_l = np.maximum(_lum(src), 1e-4)[..., None]
    out_l = np.maximum(_lum(out), 1e-4)[..., None]
    keep  = src * (out_l / src_l)          # source hue, pipeline luminance
    out   = out * (1.0 - k) + keep * k
    return np.clip(out, 0.0, 1.0)


def describe(p):
    v = ",".join(f"{x:.3f}" for x in p["veil"])
    w = ",".join(f"{x:.3f}" for x in p["wb"])
    return (f"veil[{v}] wb[{w}] in[{p['lo']:.3f},{p['hi']:.3f}] "
            f"stretch {p['stretch']:.3f} out[{p['out_lo']:.3f},{p['out_hi']:.3f}]")
