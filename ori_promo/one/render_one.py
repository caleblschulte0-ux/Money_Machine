#!/usr/bin/env python3
"""ORI — "WHAT THIS PLACE WAS". Render.

The figures are the point. Everything else is in service of making a
generated image look like it is standing on rock the camera really saw:
the plate is normalized across all shots first, the figure is tracked with
the plate so it does not slide, it is lit to match, and it carries a
contact shadow. See ai/place.py for why those four and in that order.

THE ICE GRADE is built from the plate, not painted over it. Snow goes where
the surface faces up and already catches light, which on this footage means
the flat quartzite ledges -- so the ice reads as THIS place frozen rather
than as a blue filter. The water is frozen by killing its local contrast,
because whitewater is the one thing in frame that would otherwise still be
obviously moving in a beat that claims everything is ice.
"""
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, "..")
sys.path.insert(0, "../finish")
sys.path.insert(0, ".")

import arlabel as AR
import labelkit as LK
import shotqc
import shotnorm
import filmlook as FL
from ai import place as PL
import depthtools as DT
from spec_one import (BEATS, LABELS, ICE, TITLES, UI_OFF, WEARER_BEATS,
                      SCRUB_STOPS, SCRUB_KEYS, SCRUB_FADE, SCRUB_SETTLE,
                      figures, W, H, FPS, TOTAL)

RAW = "../raw"
OUT = "out1"
CYAN = (238, 226, 120)
AMBER = (250, 206, 128)
INK = (250, 250, 248)
DIM = (198, 201, 203)

LAST_BEAT = [b[0] for b in BEATS if b[1] is not None][-1]

# Asset paths in spec_one are written from the REPO ROOT ("ai/era/..."),
# because that is where they are generated and inspected. The renderer runs
# from one/, so they are resolved here rather than written as "../ai/..." in the
# spec -- a spec full of ../ is a spec that only works from one directory.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def asset(rel):
    return rel if os.path.isabs(rel) else os.path.join(_ROOT, rel)


def mono(sz):
    return LK.mono(sz)


def frames_of(clip, tin, dur):
    n = int(round(dur * FPS))
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{tin}", "-i", f"{RAW}/IMG_{clip}.MOV",
         "-frames:v", str(n), "-vf", f"scale={W}:{H},fps={FPS}",
         "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True)
    b = r.stdout
    got = len(b) // (W * H * 3)
    if got < n:
        raise SystemExit(f"{clip}@{tin}: wanted {n} frames, got {got}")
    a = np.frombuffer(b[:n * W * H * 3], np.uint8).reshape(n, H, W, 3)
    return [f.copy() for f in a]


def _guided(guide, src, r, eps):
    """Guided filter (He, Sun & Tang). ~12 lines of box filters, no contrib.

    It re-fits a coarse mask to the edges of a guide image. That is exactly
    the problem here and there is no other tool for it in this build:
    cv2 5.0.0 ships without ximgproc, so `cv2.ximgproc.guidedFilter` does
    not exist.
    """
    k = (2 * r + 1, 2 * r + 1)
    mI, mp = cv2.blur(guide, k), cv2.blur(src, k)
    cov = cv2.blur(guide * src, k) - mI * mp
    var = cv2.blur(guide * guide, k) - mI * mI
    a = cov / (var + eps)
    return cv2.blur(a, k) * guide + cv2.blur(mp - a * mI, k)


def wearer_mask(depth, guide, lo=0.42, hi=0.52, grow=0.0, erode=6):
    """Where the present-day wearer is.

    THE HALO WAS NEVER A THRESHOLD PROBLEM. Three passes to establish that,
    and the two dead ends are worth more than the fix.

    Pass 1 (original) thresholded depth at 0.34, dilated 9x9 twice and
    blurred at sigma 5 -- ~30px of growth every direction. Inside that band
    the ORIGINAL warm plate survived while everything outside went to ice,
    so the ice beat carried a jagged ribbon of summer quartzite around his
    head. r78: "a bright cyan/white halo along the neck, shoulder, cheek and
    hair boundary ... reads as a compositing failure". Measured it is the
    opposite polarity -- ungraded WARM rock -- but the same defect, and the
    loudest amateur tell in the film.

    Pass 2 dropped the dilation and lowered the threshold to 0.22. The head
    cleaned up and a 20px warm band stayed down the cheek and neck.

    Pass 3 measured the depth profile across the edge, four scanlines. His
    face reads 0.55-0.60, the rock behind him 0.11-0.18, and the crossing is
    not uniform: 12px at the temple, 16px at the cheek, 110px at the
    out-of-focus shoulder. Moving the crossing to 0.42-0.52 should have put
    the boundary on the silhouette everywhere. It changed almost nothing --
    because the DEPTH MAP ITSELF is wrong there. Rendered as an image, its
    near-field boundary sits ~20px right of his actual edge: Depth Anything
    runs at low resolution and upsamples, and his edge is a defocus gradient
    with no depth cue in it. No threshold on that map can follow an edge the
    map does not contain.

    So the mask is snapped to the PICTURE instead. The depth threshold gives
    a coarse "him / not him", and a guided filter re-fits it to the
    luminance edges of the plate. Mask area barely moves (31.3% -> 31.1%);
    what moves is the boundary, onto his jaw. A small erosion then puts any
    residual error INSIDE him, where it grades a few pixels of his blurred
    edge slightly cold and reads as rim light -- the failure direction that
    is invisible rather than the one that tears the frame open.

    The two callers want different masks, deliberately. The GRADE must not
    reach past his silhouette, because ungraded summer rock in an ice beat
    is a visible defect. The SNOWFALL wants to be generous, because a flake
    occluded a few pixels early is invisible while a flake sitting on his
    hair is not.
    """
    if depth is None:
        return None
    d = cv2.GaussianBlur(depth.astype(np.float32), (0, 0), 3.0)
    m = np.clip((d - lo) / (hi - lo), 0, 1).astype(np.float32)
    m = np.clip((_guided(guide, m, 16, 1e-3) - 0.5) * 3.0 + 0.5, 0, 1)
    if grow > 0:
        k = int(grow) * 2 + 1
        m = cv2.dilate(m, np.ones((k, k), np.uint8))
    elif erode > 0:
        m = cv2.erode(m, np.ones((erode, erode), np.uint8))
    return cv2.GaussianBlur(m, (0, 0), 1.5 + grow * 0.5)[..., None]


def ice_grade(bgr, k, depth=None, near=None):
    """This place under ice. Built from the plate so it stays THIS place."""
    if k <= 0:
        return bgr
    f = bgr.astype(np.float32)
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0

    # SNOW where the surface is bright and flat -- upward-facing ledges. The
    # gradient test is what keeps it off the vertical rock faces and the
    # trees; a plain luminance key put snow on the sky and on the water.
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=5)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=5)
    flat = np.exp(-(gx * gx + gy * gy) * 90.0)
    lit = np.clip((g - 0.33) * 2.6, 0, 1)
    sky = np.clip((g - 0.72) * 4.0, 0, 1)          # keep snow off the sky
    snow = cv2.GaussianBlur(flat * lit * (1.0 - sky), (0, 0), 7.0)
    snow = np.clip(snow * 1.35, 0, 1)[..., None]

    # cold: desaturate, lift toward blue, crush the warm end of the rock
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] *= 0.10          # see the NO GREEN KEY note below
    cold = cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    cold = cold * np.float32([1.16, 1.04, 0.90]) + np.float32([16, 8, 0])

    # freeze the whitewater: kill its local contrast so it stops reading as
    # motion. Without this the one thing still obviously alive in an ice-age
    # frame is the river.
    blur = cv2.GaussianBlur(cold, (0, 0), 9.0)
    wet = np.clip((g - 0.55) * 3.2, 0, 1)[..., None]
    cold = cold * (1 - wet * 0.75) + blur * (wet * 0.75)

    # KILL THE SUMMER CANOPY. The first pass snowed the rock convincingly and
    # left a band of full deciduous green across the middle of an ice-age
    # frame -- and, behind it, a car park. Green is keyed directly (it is the
    # one hue that cannot survive this beat) and pushed to a dark blue-grey
    # so the treeline reads as bare cold ground rather than summer wood.
    # NO GREEN KEY. Three attempts, all measured, all dead ends -- recorded
    # so the next session does not try a fourth.
    #   hue keyed off `cold`   -- silent no-op, saturation already crushed
    #   hue keyed off the plate -- foliage is at 41, grass 26, QUARTZITE 15;
    #                              no window catches the grass and spares
    #                              the rock, and the rock must survive
    #   channel dominance      -- foliage measures G-max(R,B) = +3.8 and the
    #                              sunlit grass is R-DOMINANT at -3.8
    # This footage is high midday sun on yellow-green vegetation: it is
    # barely green in any colourspace, and nothing separates it from the
    # rock by colour. So the vegetation is not keyed at all -- saturation
    # goes to 10% globally and the canopy resolves to neutral dark clumps,
    # which is what bare winter woodland looks like anyway. The problem was
    # never that trees were present, it was that they were GREEN.

    # DISTANCE FOG. Depth Anything gives 1 near / 0 far, so this thickens with
    # distance and takes the modern park -- cars, mown grass, lamp posts --
    # with it. It is also just true: cold air over ice is hazy, and without it
    # the far bank stayed sharp enough to read as a summer afternoon.
    if depth is not None:
        # ^1.9 and 0.55, not ^1.25 and 0.72: the first pass fogged the whole
        # frame milky and threw away the foreground contrast that makes the
        # snow read as snow. Steeper falloff keeps the near shelf crisp and
        # still buries the car park.
        far = np.clip(1.0 - depth, 0, 1)[..., None] ** 1.9
        cold = cold * (1 - far * 0.55) + np.float32([226, 224, 218]) * (far * 0.55)

    iced = cold * (1 - snow * 0.72) + np.float32([248, 246, 240]) * (snow * 0.72)

    # THE WEARER DOES NOT FREEZE. He is a present-day person looking AT a
    # visualisation, so the world changes around him and he does not change
    # with it -- which is also exactly what a pair of AR glasses does. The
    # first pass iced his face and hair along with the river and it read as
    # a period photograph of a boy in a blizzard.
    # This comment used to say depth separates him outright -- "his head
    # sits at 0.65-0.75 and NOTHING else is above 0.19, so a threshold at
    # 0.40 takes him and touches nothing else". Both halves are true and the
    # conclusion was still wrong: it is a statement about the INTERIOR of
    # two regions and says nothing about where the boundary between them
    # falls, which is the only thing that matters here. See wearer_mask.
    # NOT A HARD ON/OFF. He keeps 88% of his present-day self and takes 12%
    # of the cold, which is what standing in front of a large cold surface
    # actually does to a person and what stops the separation reading as a
    # key. r78: "keep a small amount of environmental cooling / reflected
    # light on the wearer so the separation is intentional without looking
    # keyed."
    if near is not None:
        iced = iced * (1 - near * 0.88) + f * (near * 0.88)

    return np.clip(f * (1 - k) + iced * k, 0, 255)


# ---- snowfall, drawn INSIDE the beat rather than composited from a clip
#
# The ice beat was nine seconds of a mammoth standing still. Everything in
# it was correct and nothing in it MOVED, so it read as a colour grade
# rather than as weather.
#
# Two things make this worth doing in the renderer instead of over the top
# of the finished master. It is driven by the same k the ice grade uses, so
# the snow arrives and leaves exactly with the cold instead of needing its
# own hand-matched fade. And it respects DEPTH: the snow belongs to the
# visualised world, so it falls BEHIND the wearer, who is a present-day
# person and is already excluded from the grade for the same reason.
_SNOW_N = 520
_srng = np.random.default_rng(11)
_SNOW = dict(
    x=_srng.uniform(0, W, _SNOW_N),
    y=_srng.uniform(0, H, _SNOW_N),
    d=_srng.uniform(0.30, 1.0, _SNOW_N),          # far -> near
    vx=_srng.uniform(-26, 26, _SNOW_N),
    ph=_srng.uniform(0, 6.28, _SNOW_N),
)


def snowfall(frame, t, k, near=None):
    """Additive flakes. k is the ice amount, so snow follows the grade."""
    if k <= 0.02:
        return frame
    d = _SNOW["d"]
    vy = 70.0 + 210.0 * d
    fx = (_SNOW["x"] + _SNOW["vx"] * t + 16.0 * d * np.sin(1.6 * t + _SNOW["ph"])) % W
    fy = (_SNOW["y"] + vy * t) % H
    lay = np.zeros((H, W), np.float32)
    # near flakes are bigger, brighter and slightly streaked by their own speed
    for xi, yi, dd, vyy in zip(fx.astype(int), fy.astype(int), d, vy):
        r = int(1 + 2.4 * dd)
        streak = int(1 + vyy * 0.012)
        y0, y1 = max(0, yi - streak), min(H, yi + r)
        x0, x1 = max(0, xi - r), min(W, xi + r)
        if y1 > y0 and x1 > x0:
            lay[y0:y1, x0:x1] += 0.35 + 0.65 * dd
    lay = cv2.GaussianBlur(lay, (0, 0), 0.8)
    if near is not None:
        lay *= (1.0 - near[..., 0])          # snow falls BEHIND him
    return np.clip(frame + lay[..., None] * (58.0 * k), 0, 255)


def draw_label(d, anchor, box, title, sub, k, col=CYAN):
    LK.block(d, anchor, box, title, sub, k, col, W, H)


def draw_title(d, t, dur, title, sub, t0, scale=1.0):
    """The location title under the montage. DELIBERATELY NOT AN AR LABEL.

    No reticle, no leader, no cyan, no corner cues -- a lower-left block in
    the film's own voice. The AR vocabulary means "the system recognised
    this"; the montage is documentary footage of a park and claims nothing,
    so it must not borrow that vocabulary. Same reason UI_OFF exists.

    IT NEEDS A SCRIM. The first render put white text straight onto the
    plate and the subtitle was effectively invisible: bC's lower third is
    sunlit quartzite and lit grass, which is exactly the luminance of the
    type. The AR labels never hit this because LK.block carries its own
    plate. A bottom gradient is the documentary equivalent -- full width,
    because a partial-width scrim leaves a vertical seam down the middle
    of the frame.
    """
    k = AR.ease(min(1.0, max(0.0, (t - t0) / 0.4)))
    k *= min(1.0, max(0.0, (dur - 0.06 - t) / 0.25))
    if k <= 0:
        return
    band = 300
    for i in range(band):
        a = int(150 * k * (i / band) ** 1.6)
        if a:
            d.line([(0, H - band + i), (W, H - band + i)], fill=(5, 8, 11, a))
    x, y = 96, SAFE_B - 74
    f1, f2 = LK.inter(int(58 * scale)), mono(int(28 * scale))
    sub_dy = int(46 * scale)
    d.rectangle([x - 26, y - int(46 * scale), x - 22, y + sub_dy + 14],
                fill=INK + (int(215 * k),))
    d.text((x + 2, y + 3), title, font=f1, fill=(5, 8, 11, int(170 * k)), anchor="ls")
    d.text((x, y), title, font=f1, fill=INK + (int(252 * k),), anchor="ls")
    d.text((x + 4, y + sub_dy + 3), sub, font=f2, fill=(5, 8, 11, int(150 * k)), anchor="ls")
    d.text((x + 2, y + sub_dy), sub, font=f2, fill=DIM + (int(240 * k),), anchor="ls")


def frame_cue(d, t, dur):
    """DELETED, deliberately, and left here saying so.

    This drew eight corner brackets around the frame. It is the single
    most recognisable amateur "hi-tech overlay" cliche there is, it was
    doing no work the 2.39 frame does not now do better, and it was part
    of what the operator meant by "it still looks like a middle school
    iMovie". The scope bars frame the picture; brackets on top of bars is
    two framing devices arguing.
    """
    return


DISSOLVE = 0.5          # seconds of cross-dissolve into each beat
FIGURE_MAX_DRIFT = 0.03  # a plate carrying a figure must be this static


# ---- the era rail -------------------------------------------------------
# The HUD lives inside the 2.39 frame now. Anything at the old y-positions
# would be drawn into the black bars and simply vanish.
SAFE_T, SAFE_B = FL.safe_area(H, W)
RAIL_X0, RAIL_X1, RAIL_Y = 620, 1300, SAFE_B - 66

_ARRIVALS = [t for (pt, pp), (t, p) in zip(SCRUB_KEYS, SCRUB_KEYS[1:]) if p != pp]


def _settle(tf):
    """1.0 for SCRUB_SETTLE seconds after the marker lands, else 0."""
    for t in _ARRIVALS:
        if 0.0 <= tf - t <= SCRUB_SETTLE:
            return 1.0 - (tf - t) / SCRUB_SETTLE
    return 0.0


def _scrub_pos(tf):
    """Marker position 0..1 at film time tf, linear between keyframes."""
    ks = SCRUB_KEYS
    if tf <= ks[0][0]:
        return ks[0][1]
    for (t0, p0), (t1, p1) in zip(ks, ks[1:]):
        if tf <= t1:
            u = (tf - t0) / max(1e-6, t1 - t0)
            return p0 + (p1 - p0) * AR.ease(u)
    return ks[-1][1]


def draw_rail(d, tf):
    """The scrub the wearer is driving. Drawn UI only — no new assets.

    This is the answer to r88's "the overlays arrive as demonstrations
    instead of consequences of an action". The marker moves FIRST and the
    world answers behind it, which is the whole difference between a demo
    reel and something that feels operated.

    It is deliberately plain: a rail, three stops, a marker. Anything more
    decorative would read as a video-editor timeline pasted over a park,
    and the point is that a person wearing these is scrubbing TIME.
    """
    t0, fade, out_t, out_len = SCRUB_FADE
    k = AR.ease(min(1.0, max(0.0, (tf - t0) / fade)))
    k *= min(1.0, max(0.0, 1.0 - (tf - out_t) / out_len))
    if k <= 0.004:
        return
    a = int(210 * k)
    # A SCRIM, for the same reason the location title needed one. Measured
    # on a finished render: on the wide-valley plate the rail runs across
    # sunlit quartzite that is the same luminance as the type, and it
    # effectively disappeared -- on the one beat where the marker is
    # travelling to deep time, which is the single moment the whole device
    # exists to show. Legibility cannot depend on what the camera happened
    # to be pointed at.
    band_t, band_b = RAIL_Y - 44, min(RAIL_Y + 52, SAFE_B - 2)
    for yy in range(band_t, band_b):
        u = (yy - band_t) / float(max(1, band_b - band_t))
        aa = int(195 * k * (1.0 - abs(u - 0.42) * 1.7))
        if aa > 0:
            d.line([(RAIL_X0 - 150, yy), (RAIL_X1 + 150, yy)], fill=(5, 8, 11, aa))
    # a dark keyline under the rule and every label. r90: the "pale
    # inactive labels and fine rule sit against sunlit quartzite" and the
    # centre label "visually tangles with the textured background".
    d.line([(RAIL_X0, RAIL_Y + 1), (RAIL_X1, RAIL_Y + 1)], fill=(5, 8, 11, int(150 * k)), width=3)
    d.line([(RAIL_X0, RAIL_Y), (RAIL_X1, RAIL_Y)], fill=INK + (int(150 * k),), width=2)
    fn = mono(21)
    pos = _scrub_pos(tf)
    for label, p in SCRUB_STOPS:
        x = int(RAIL_X0 + (RAIL_X1 - RAIL_X0) * p)
        near = 1.0 - min(1.0, abs(pos - p) * 3.6)
        d.line([(x, RAIL_Y - 9), (x, RAIL_Y + 9)],
               fill=INK + (int((95 + 160 * near) * k),), width=2)
        tw = d.textlength(label, font=fn)
        col = CYAN if near > 0.55 else INK
        la = int((78 + 175 * near) * k)
        d.text((x - tw / 2 + 1, RAIL_Y + 21), label, font=fn, fill=(5, 8, 11, int(la * 0.85)))
        d.text((x - tw / 2, RAIL_Y + 20), label, font=fn, fill=col + (la,))
    mx = int(RAIL_X0 + (RAIL_X1 - RAIL_X0) * pos)
    # THE SETTLE. r90 asked for the marker to hold or pulse at its
    # destination inside the lead, so the viewer sees three separate
    # events -- marker moves, marker SETTLES, world changes.
    st = _settle(tf)
    if st > 0:
        r = int(9 + 16 * (1.0 - st))
        d.ellipse([mx - r, RAIL_Y - r, mx + r, RAIL_Y + r],
                  outline=CYAN + (int(a * st * 0.85),), width=2)
    d.ellipse([mx - 7, RAIL_Y - 7, mx + 7, RAIL_Y + 7], outline=CYAN + (a,), width=2)
    d.ellipse([mx - 2, RAIL_Y - 2, mx + 2, RAIL_Y + 2], fill=CYAN + (a,))


def compose(beat, dur, frames, prev_last=None, global_i=0):
    beat_start = {b[0]: b[3] for b in BEATS}[beat]
    gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]
    figs = figures(beat)
    lab = LABELS.get(beat)
    ttl = TITLES.get(beat)

    # Depth once, from the first frame. The camera pans but the SCENE does
    # not change, so a per-frame depth pass would cost minutes and buy a
    # difference no viewer can see.
    dep0 = DT.depth(frames[0]) if (figs or beat in ICE) else None

    # track every figure's foot point and the label anchor with the plate
    fpaths = [AR.track_anchor(gray, f[1]) for f in figs]
    lpath = AR.track_anchor(gray, lab[0]) if lab else None
    cuts = [PL.matte(asset(f[0])) for f in figs]

    icespec = ICE.get(beat)
    # ONCE PER BEAT, not once per frame. The plate's depth is taken from the
    # first frame (the camera pans, the scene does not change), so the masks
    # derived from it are constant too -- and the guided filter is the most
    # expensive thing in the ice path.
    # DEPTH PER FRAME ON AN ICE BEAT. Everywhere else one depth pass from
    # frame 0 is right -- the camera barely moves and figure occlusion does
    # not care about a few pixels. The ice matte does: it is a hard visual
    # boundary drawn across a face, and holding it static was worth watching
    # go wrong. Frames 0-2s of e3 were clean and by 4s the warm band was
    # back, because a static mask only fits the frame it was measured on.
    # 0.6s per frame, ~110s per ice beat, and it retires the entire class.
    # DEPTH IS COMPUTED PER FRAME, NOT PRECOMPUTED INTO A LIST.
    # It used to build `[DT.depth(f) for f in frames]` up front, which on
    # a six-second ice beat is 180 float32 depth maps held at once -- 1.4
    # GB, on top of the frames, the greys, and the float copies the film
    # look makes. v12 died silently part-way through encoding `ice`: no
    # traceback, no error line, the log simply stopping after "more
    # composed". That is what an OOM kill looks like from the inside, and
    # it is the same failure this renderer had once before when it tried
    # to hold every plate at once. The depth pass is per-frame work
    # anyway; holding the results bought nothing.

    tag_a = 0.0
    for i, f in enumerate(frames):
        t = i / FPS
        # The photographic layer is graded BEFORE anything is drawn on
        # it, so the HUD stays clean while the plate gets the look.
        plate = FL.grade(f.astype(np.float32))
        base = plate.copy()

        if icespec:
            # FULL ENVELOPE, not a direction. v6's ICE was (direction, a0,
            # a1) -- a beat could ramp in or out but not both, so an ice
            # beat necessarily ENDED frozen and the cut off it swapped a
            # white valley for a sunlit one in a single frame. Measured on
            # v6, boundary frames like that changed 80% of the picture at
            # once and are what the operator felt as strobing. The
            # envelope lets the thaw happen on screen, inside the beat.
            i0, i1, o0, o1 = icespec
            k_ice = AR.ease(min(1.0, max(0.0, (t - i0) / max(1e-6, i1 - i0))))
            if o0 is not None:
                k_ice *= 1.0 - AR.ease(min(1.0, max(0.0, (t - o0) / max(1e-6, o1 - o0))))
            if k_ice > 0.002:
                dpi = DT.depth(f)
                gi = gray[i].astype(np.float32) / 255.0
                # NO WEARER, NO WEARER MASK. The mask is a depth threshold
                # and it always returns SOMETHING -- on the wide valley
                # plate, which has nobody within thirty metres, it claims
                # 22% of the frame (the foreground rock) and would hold a
                # raw summer-coloured slab out of an ice age. Whether a
                # plate contains a near person is a fact about the plate,
                # so the spec states it.
                has_wearer = beat in WEARER_BEATS
                base = ice_grade(base.astype(np.uint8), k_ice, depth=dpi,
                                 near=wearer_mask(dpi, gi) if has_wearer else None)
                base = snowfall(base, t, k_ice,
                                near=(wearer_mask(dpi, gi, lo=0.25, hi=0.40,
                                                  grow=6) if has_wearer else None))

        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        showing = False       # is any generated figure on screen right now?

        for (src, _fx, hpx, t0, build, sdep, mtch, toff, shw), path, cut in zip(
                figs, fpaths, cuts):
            foot = path[min(i, len(path) - 1)]
            lt = t - t0
            if lt < -0.55:
                continue
            if lt < 0:
                showing = True
                AR.reticle(d, (foot[0], foot[1] - hpx * 0.5), t - (t0 - 0.55),
                           dur=0.55, col=CYAN, a=235)
                continue
            k = min(1.0, lt / build)
            # THE FIGURE MAY LEAVE. On the closer each era is scrubbed
            # through rather than assembled, so it fades back out over
            # 0.3s and the reveal is suppressed once it starts leaving --
            # a resolve line rising up a figure that is on its way out
            # reads as it arriving again.
            going = False
            if toff is not None:
                if t >= toff:
                    k *= max(0.0, 1.0 - (t - toff) / 0.30)
                    going = True
                if k <= 0.002:
                    continue
            # NO RESOLVE LINE ON A FLASH. The reveal draws a warm band
            # travelling up the figure, which over a 1.4s build is the
            # "system placing something" moment and over a 0.3s one is a
            # red smear across a woman's chest -- which is exactly what
            # the first cut of the new ending looked like. A figure with
            # an out-time is a RECALL of something already revealed, so
            # it just appears.
            showing = True
            base = PL.place(base, cut, foot, hpx, k=k,
                            depth=dep0, subj_depth=sdep,
                            reveal=(toff is None and k < 1.0), match=mtch,
                            shadow_strength=shw)

        if lab and lpath:
            (_, title, sub, t0, off) = lab
            cx, cy = lpath[min(i, len(lpath) - 1)]
            if t >= t0:
                k = AR.ease(min(1.0, (t - t0) / 0.5))
                k *= min(1.0, max(0.0, (dur - 0.12 - t) / 0.45))
                if k > 0:
                    draw_label(d, (cx, cy), (cx + off[0], cy + off[1]), title, sub, k)

        # THE HONESTY TAG FOLLOWS THE FIGURES, NOT THE BEAT.
        # It used to be drawn whenever the BEAT contained figures, which on
        # the rebuilt closer meant it stayed up for the last two seconds
        # after every era had gone -- r82: "the frame is now the present-day
        # plate, and the persistent banner suggests a generated element
        # still exists". That is not just distracting, it is inaccurate in
        # the direction that matters: a label reading NOT A PHOTOGRAPH over
        # unmodified photography. It now tracks whether anything generated
        # is actually on screen, reticle included, and follows it with a
        # 0.35s ramp so it does not blink between flashes.
        step = 1.0 / (0.35 * FPS)
        tag_a = min(1.0, tag_a + step) if showing else max(0.0, tag_a - step)
        if tag_a > 0.004:
            tg = AR.ease(tag_a)
            tg *= min(1.0, max(0.0, (dur - 0.12 - t) / 0.45))
            if tg > 0:
                # TOP LEFT, not centred. Centred, it sat directly across
                # the mammoth's head and back once the animal was sized
                # correctly (r92: "its head and back collide with
                # VISUALISATION — NOT A PHOTOGRAPH"). The left column is
                # empty on every beat -- the titles live bottom-left and
                # the figures live right of centre -- so the disclosure
                # goes where nothing else is rather than where the frame
                # happens to be symmetric.
                fn = mono(28)
                s = "VISUALISATION — NOT A PHOTOGRAPH"
                tw = d.textlength(s, font=fn)
                x0 = 96
                d.rectangle([x0 - 18, SAFE_T + 26, x0 + tw + 18, SAFE_T + 70],
                            fill=(6, 9, 12, int(175 * tg)))
                d.text((x0, SAFE_T + 49), s, font=fn, fill=AMBER + (int(240 * tg),),
                       anchor="lm")

        if beat not in UI_OFF:
            frame_cue(d, t, dur)
            draw_rail(d, beat_start + t)
        if ttl:
            draw_title(d, t, dur, ttl[0], ttl[1], ttl[2],
                       scale=(ttl[3] if len(ttl) > 3 else 1.0))
        ov = np.array(img).astype(np.float32)
        a = ov[..., 3:4] / 255.0
        out = np.clip(base * (1 - a) + ov[..., :3][..., ::-1] * a, 0, 255)

        # END-CARD RELEASE (r74's invariant, kept). The end card holds the
        # last beat's final composed frame, so anything still drawn then is
        # baked in behind the wordmark.
        if beat == LAST_BEAT:
            rel = min(1.0, max(0.0, (dur - 0.12 - t) / 0.45))
            if rel < 1.0:
                # release to the GRADED plate, not the raw one -- releasing
                # to `f` would have thrown the whole film look off in the
                # last half second and the assertion would have enforced it
                out = out * rel + plate * (1.0 - rel)
            if i == len(frames) - 1:
                assert rel == 0.0 and np.allclose(out, plate, atol=1.0), (
                    f"{beat}: final frame still carries overlay (rel={rel:.4f})")

        # CROSS-DISSOLVE INTO THIS BEAT. Operator on v6: "It's not the
        # flashing. It's the fast cuts." Cutting less often was half the
        # fix; the other half is that the remaining cuts should not be
        # hard. Measured on v6, a beat boundary changed 71-82% of the
        # picture in a single frame -- spread over 15 frames that is a
        # transition instead of a jolt.
        # It dissolves from the previous beat's LAST COMPOSED FRAME held
        # still, not from live footage. On these plates that is very
        # nearly the same picture: every plate in the cut drifts 0.0-0.6%
        # over its whole duration, so half a second of it is motionless to
        # the eye. Holding one frame keeps every beat's own length, and
        # therefore every label, tick and score boundary, exactly where
        # the spec says it is -- an overlap would have silently shifted
        # the entire timeline under them.
        if prev_last is not None and i < int(DISSOLVE * FPS):
            a = AR.ease((i + 1) / (DISSOLVE * FPS))
            out = out * a + prev_last.astype(np.float32) * (1.0 - a)
        # vignette, moving grain, scope bars -- last thing that touches it
        out = FL.finish(out, global_i + i)
        yield out.astype(np.uint8)


def encode(gen, dst, crf=13):
    enc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
         "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p", dst],
        stdin=subprocess.PIPE)
    last = None
    for fr in gen:
        enc.stdin.write(fr.tobytes())
        last = fr
    enc.stdin.close()
    enc.wait()
    return last


def main(only=None):
    """MEASURE FROM ONE FRAME EACH, THEN PROCESS ONE BEAT AT A TIME.

    The first version loaded all seven plates, normalized them all, and then
    composed. That is 57 seconds of 1080p held at once -- 9.9 GB as uint8
    before any float32 copy -- and the cgroup killed it at 13.9 GB RSS with
    no traceback, the log simply stopping after "open normalized".

    Shot normalization has to span every plate or a re-normalized shot
    flashes against its neighbours, but it only ever MEASURES the first
    frame of each. So the measure pass holds seven frames, not seventeen
    hundred, and each beat is then loaded, normalized, composed, encoded
    and dropped before the next one is touched. Peak is one beat.
    """
    os.makedirs(OUT, exist_ok=True)
    rows = [(b, c, t, d) for b, c, t, d, _n in
            [(x[0], x[1], x[2], x[4], x[5]) for x in BEATS] if c]

    flagged = shotqc.report([(b, c, t, d) for b, c, t, d in rows], raw=RAW)
    print("  GATE FLAGGED A PLATE" if flagged else
          "  footage gate: all plates pass", flush=True)

    # A FIGURE MAY NOT STAND ON A PANNING PLATE.
    # OPERATOR, on v11: "The Indian one looks like shit ... don't use a
    # panning shot for the ai overlays." He is right and it is not a taste
    # call, it is geometry: a composited figure is tracked to the plate,
    # and every pixel of tracking error shows up as the figure SLIDING
    # against ground that is itself moving. On a static plate an error of
    # two pixels is invisible; on a plate drifting 17% of frame width it
    # reads as the figure swimming.
    # I chose IMG_6687 for the second Dakota group off its composition
    # without looking at the drift I had already measured -- 16.7% -- so
    # this is now checked at render time rather than left to my judgement.
    for b, c, tin, dur in rows:
        if not figures(b):
            continue
        m = shotqc.motion(c, tin, dur, raw=RAW)
        if m and m["drift"] > FIGURE_MAX_DRIFT:
            raise SystemExit(
                f"REFUSING TO RENDER: beat {b!r} places a figure on IMG_{c} "
                f"@{tin}s, which drifts {m['drift']*100:.1f}% over {dur}s. "
                f"Figures require a static plate (under "
                f"{FIGURE_MAX_DRIFT*100:.0f}%). Pick a different plate or "
                f"move the figure.")
    print(f"  figure plates: all under {FIGURE_MAX_DRIFT*100:.0f}% drift",
          flush=True)

    # EVERY FIGURE MUST FIT INSIDE THE SCOPE FRAME.
    # Moving the second Dakota group clear of the rail's scrim put its
    # feet at y=955, and the 2.39 active picture ends at 942 -- so the
    # feet, the one part of a composite that has to be visible, were
    # inside the black bar. The mammoth had the mirror problem at the top.
    # Both were fixes for a different constraint that violated this one,
    # which is precisely the kind of thing a person checking by eye keeps
    # missing and arithmetic never does.
    for b, c, tin, dur in rows:
        for (src, foot, hpx, t0, build, sdep, mtch, toff, shw) in figures(b):
            top, feet = foot[1] - hpx, foot[1]
            if top < SAFE_T or feet > SAFE_B:
                raise SystemExit(
                    f"REFUSING TO RENDER: {os.path.basename(src)} on beat "
                    f"{b!r} spans y {top}-{feet}, outside the 2.39 active "
                    f"picture ({SAFE_T}-{SAFE_B}). "
                    f"{'Its head is in the top bar. ' if top < SAFE_T else ''}"
                    f"{'Its feet are in the bottom bar.' if feet > SAFE_B else ''}")
    print("  figures: all inside the scope frame", flush=True)

    # SHOTNORM WORKS IN FLOAT 0..1 AT BOTH ENDS. Passing it uint8 does not
    # raise -- measure() just takes percentiles over a 0..255 range, so the
    # whole plan comes out garbage, and apply() then returns float 0..1
    # where the renderer expects uint8. That second half surfaced as an
    # OpenCV assert inside the Lucas-Kanade tracker three beats later, and
    # the two beats BEFORE it did not error at all: goodFeaturesToTrack
    # found too few corners on a float image and quietly fell back to phase
    # correlation. Silently degraded tracking is the worse of the two.
    # Measure on the delivered 16:9 region, three frames per plate averaged,
    # the way film1 does it.
    stats = []
    for b, c, tin, dur in rows:
        ims = frames_of(c, tin, min(dur, 2.1))
        picks = [ims[j] for j in (2, len(ims) // 2, len(ims) - 1)]
        per = [shotnorm.measure(
                   shotnorm.deliver_region(i.astype(np.float32) / 255.0, aspect=16 / 9))
               for i in picks]
        m = {}
        for k in per[0]:
            v = np.mean([np.asarray(x[k], dtype=np.float64) for x in per], axis=0)
            m[k] = v if getattr(v, "ndim", 0) else float(v)
        stats.append(m)
        del ims, picks
    tgt, params = shotnorm.plan(stats)
    print(f"  normalization measured across {len(rows)} plates "
          f"(black {tgt['black']:.4f} white {tgt['white']:.4f})", flush=True)

    # Carried between beats so each one can dissolve out of the last frame
    # of the one before it. Rendering a subset (`render_one.py ice`) leaves
    # it None for the first beat rendered, which is correct: that beat has
    # no predecessor in THIS run to dissolve from.
    prev_last = None
    gi = 0          # running frame index, so the grain keeps moving across cuts
    for (b, c, tin, dur), p in zip(rows, params):
        if only and b not in only:
            continue
        fr = [(np.clip(shotnorm.apply(f.astype(np.float32) / 255.0, p), 0, 1) * 255
               ).astype(np.uint8) for f in frames_of(c, tin, dur)]
        prev_last = encode(compose(b, dur, fr, prev_last, gi), f"{OUT}/{b}_t.mp4")
        gi += len(fr)
        del fr
        print(f"  {b} composed", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:] or None)
