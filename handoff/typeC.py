#!/usr/bin/env python3
"""FILM C r56: the typographic layer.

r55: "Typography and rule graphics must be vector-sharp, intentionally spaced,
and legible at review-grid scale. Avoid generic dashboard chrome, decorative
widgets, tiny status text, glow, and continuous wallpaper UI."

So: no panels, no boxes round everything, no HUD. One consistent lower-left
block per rule -- a hairline, a number, the rule, and its truth status -- plus
whatever that specific rule needs to be understood, placed where it belongs in
the picture rather than in a corner widget. Everything is drawn at full 1920
resolution with PIL and never scaled up.

The scrim is LOCAL. A full-frame darkening would turn the film back into the
black engineering slide deck r55 rejected, so each block sits on a soft
gradient that fades out well before the middle of the frame.

All on-screen wording is r32's approved language, unchanged. The truth-status
vocabulary is exactly two values -- DESIGN REQUIREMENT and PROTOTYPE TARGET --
and CONFIRMED BUILT is not among them.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
FDIR = "../fonts/inter/extras/ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
MONOB = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

INK    = (247, 247, 245)
DIM    = (196, 198, 196)
AMBER  = (238, 178, 42)
OPEN   = (232, 122, 74)      # an indicator that is NOT satisfied
HAIR   = (255, 255, 255)

M = 108                      # margin


def _f(name, size):
    return ImageFont.truetype(os.path.join(FDIR, name), size)

def inter(size, w="SemiBold"):  return _f(f"Inter-{w}.ttf", size)
def mono(size, bold=False):     return ImageFont.truetype(MONOB if bold else MONO, size)


def ease(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def track_w(d, text, font, sp):
    return sum(d.textlength(c, font=font) for c in text) + sp*max(0, len(text)-1)


SHADOW = (6, 7, 9)


def track_sh(d, xy, text, font, fill, sp=0.0, anchor="ls", off=2, a=None):
    """tracked text with a dark drop shadow underneath"""
    al = fill[3] if len(fill) > 3 else 255
    sa = int((a if a is not None else 0.72) * al)
    x, y = xy
    track(d, (x + off, y + off), text, font, SHADOW + (sa,), sp=sp, anchor=anchor)
    track(d, (x, y), text, font, fill, sp=sp, anchor=anchor)


def rect_sh(d, box, fill, off=2, a=0.72):
    al = fill[3] if len(fill) > 3 else 255
    x0, y0, x1, y1 = box
    d.rectangle([x0+off, y0+off, x1+off, y1+off], fill=SHADOW + (int(a*al),))
    d.rectangle(box, fill=fill)


def track(d, xy, text, font, fill, sp=0.0, anchor="ls"):
    """Letterspaced text. PIL has no tracking and the spacing IS the design.

    Anchoring has to be done by hand: PIL's own anchor applies per glyph, so
    a right-anchored tracked string drawn glyph by glyph still runs to the
    RIGHT of the anchor and straight off the frame. Four labels did exactly
    that in the first pass."""
    x, y = xy
    if sp == 0.0:
        d.text((x, y), text, font=font, fill=fill, anchor=anchor); return
    w = track_w(d, text, font, sp)
    if anchor[0] == "r": x -= w
    elif anchor[0] == "m": x -= w/2
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill, anchor="ls")
        x += d.textlength(ch, font=font) + sp


def scrim(img, boxes, strength=0.62, feather=260):
    """Soft local gradients under the text blocks -- never the whole frame.

    Takes a LIST, because rule 05 carries its review gate on the opposite side
    of the picture from its rule block and each needs its own falloff."""
    if boxes and not isinstance(boxes[0], (list, tuple)):
        boxes = [boxes]
    a = np.zeros((H, W), np.float32)
    for x0, y0, x1, y1 in boxes:
        a[max(0,y0):min(H,y1), max(0,x0):min(W,x1)] = 1.0
    import cv2
    a = cv2.GaussianBlur(a, (0, 0), feather/3.0)
    a = np.clip(a * strength, 0, 1)
    base = np.array(img).astype(np.float32)
    base[..., 3] = np.maximum(base[..., 3], a*255)
    dark = np.zeros_like(base); dark[..., 3] = a*255
    return base, dark


def hairline(d, x, y, w, t, colour=HAIR, alpha=230):
    ww = int(w * ease(t))
    if ww > 0:
        d.rectangle([x, y, x+ww, y+2], fill=colour + (alpha,))


def rule_block(d, num, name, status, t, dur):
    """The one consistent element: hairline, number, rule, truth status."""
    x, y = M, H - 300
    fade = 1.0 if t < dur - 0.4 else max(0.0, (dur - t)/0.4)
    a = lambda v: int(v * fade)
    hairline(d, x, y - 78, 640, t/0.45)
    if t > 0.14:
        k = ease((t - 0.14)/0.5)
        dy = int((1 - k) * 16)
        track(d, (x, y + dy), f"RULE {num}", mono(27), DIM + (a(int(232*k)),), sp=7.0)
        d.text((x, y + 96 + dy), name, font=inter(70), fill=INK + (a(int(255*k)),), anchor="ls")
    if t > 0.72:
        k = ease((t - 0.72)/0.45)
        col = AMBER if status == "PROTOTYPE TARGET" else DIM
        yy = y + 146
        d.rectangle([x, yy, x+3, yy+34], fill=col + (a(int(240*k)),))
        track(d, (x+22, yy+27), status, mono(25, True), col + (a(int(238*k)),), sp=4.0)


def open_indicator(d, x, y, label, t, delay):
    """An indicator that is OPEN. Hollow, never a tick -- see the r05 note.

    r58 sized these up ~18% and opened their spacing: at review-grid scale the
    structure read but the individual items did not. Still hollow rings, still
    no completion state of any kind."""
    if t < delay: return
    k = ease((t - delay)/0.4); al = int(244*k)
    d.ellipse([x+2, y+2, x+28, y+28], outline=SHADOW + (int(0.7*al),), width=3)
    d.ellipse([x, y, x+26, y+26], outline=OPEN + (al,), width=3)
    track_sh(d, (x+46, y+22), label, mono(28), INK + (al,), sp=3.2)


def compose(beat, t, dur):
    """-> (rgba overlay, darken layer) for one frame"""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    box = None

    if beat == "open":
        # r31/r55: the hook is on screen immediately, BEFORE the calibration line.
        if t > 0.10:
            k = ease((t - 0.10)/0.30)
            d.text((M, 470), "THE EXPERIENCE ONLY WORKS IF—", font=inter(92),
                   fill=INK + (int(255*k),), anchor="ls")
            hairline(d, M, 512, 1120, (t - 0.10)/0.5)
        if t > 0.95:
            k = ease((t - 0.95)/0.4)
            track(d, (M, 576), "SITE EXPERIENCE / DESIGN CONSTRAINTS",
                  mono(30), DIM + (int(232*k),), sp=5.5)
        if t > 1.5:
            k = ease((t - 1.5)/0.5)
            track(d, (M, H - M), "SITE REFERENCE / FALLS PARK",
                  mono(24), DIM + (int(190*k),), sp=4.0)
        box = (0, 330, 1500, 700)

    elif beat.startswith("r"):
        from sourcesC import RULES
        num, name, status = [r for r in RULES if r[0] == beat[1:]][0]
        rule_block(d, num, name, status, t, dur)
        box = (0, H-430, 1180, H)
        if beat in ("r02", "r03", "r06"):
            box = [(0, H-430, 1180, H), (1120, 100, W, 330)]
        if beat == "r05":
            box = [(0, H-430, 1180, H), (1290, 140, W, 740)]

        if beat == "r02" and t > 1.9:
            k = ease((t - 1.9)/0.45)
            track(d, (W - M, 210), "EXISTING PATH / UNMODIFIED",
                  mono(28), DIM + (int(226*k),), sp=4.5, anchor="rs")

        if beat == "r03" and t > 1.9:
            k = ease((t - 1.9)/0.45)
            track(d, (W - M, 210), "LOCAL SITE PACKAGE",
                  mono(28), INK + (int(232*k),), sp=4.5, anchor="rs")
            if t > 2.5:
                k2 = ease((t - 2.5)/0.45)
                track(d, (W - M, 254), "NO LIVE NETWORK REQUIRED",
                      mono(26), DIM + (int(220*k2),), sp=4.0, anchor="rs")

        if beat == "r04":
            # Placed against THIS plate, at the middle of its own on-screen
            # window: the falls and the pool are left of centre, and the dry
            # shelf people are standing on is centre-right. The bracket
            # encloses the people, because they ARE the evidence that the
            # viewing area is a place you can stand.
            #
            # It is a STATIC schematic over a plate that pans slowly right, so
            # it is taken down at t=5.3 -- before the pan carries the shelf out
            # from under it. Tracking it to the rock instead would mean warping
            # a drawn annotation frame by frame, which is the bowing/drifting
            # geometry r55 rules out. A shorter honest hold beats a tracked one
            # that breathes.
            go = 1.0 if t < 5.3 else max(0.0, (5.9 - t)/0.6)
            if t > 1.7:
                k = ease((t - 1.7)/0.5); al = int(238*k*go)
                rect_sh(d, [784, 545, 1252, 548], HAIR + (al,))
                rect_sh(d, [784, 545, 787, 582], HAIR + (al,))
                rect_sh(d, [1249, 545, 1252, 582], HAIR + (al,))
                track_sh(d, (784, 523), "VIEWING AREA", mono(27), INK + (al,), sp=4.5)
            if t > 2.5:
                k = ease((t - 2.5)/0.5); al = int(234*k*go)
                for i in range(12):
                    x0 = 300 + i*38
                    rect_sh(d, [x0, 648, x0+20, 651], OPEN + (al,))
                track_sh(d, (300, 626), "EXCLUSION EDGE", mono(27), OPEN + (al,), sp=4.5)
            if t > 3.4:
                k = ease((t - 3.4)/0.5)
                track_sh(d, (300, 700), "ENTRY EDGE", mono(24), DIM + (int(214*k*go),), sp=4.0)

        if beat == "r05":
            # r55: an UNCOMPLETED gate. Open indicators, nothing approved,
            # no reviewer named, no completed review implied anywhere.
            if t > 1.5:
                k = ease((t - 1.5)/0.4)
                track(d, (W - M, 210), "HISTORICAL", mono(31), INK + (int(240*k),), sp=5.0, anchor="rs")
                track(d, (W - M, 254), "REVIEW GATE", mono(31), INK + (int(240*k),), sp=5.0, anchor="rs")
                d.rectangle([W-M-352, 232, W-M, 234], fill=HAIR + (int(150*k),))
            for i, lab in enumerate(["NARRATIVE TEXT", "RECONSTRUCTION",
                                     "PLACEMENT", "ATTRIBUTION"]):
                open_indicator(d, 1392, 312 + i*66, lab, t, 2.1 + i*0.28)
            if t > 4.0:
                k = ease((t - 4.0)/0.5); al = int(240*k)
                rect_sh(d, [1392, 596, 1396, 674], OPEN + (al,))
                track_sh(d, (1424, 628), "RELEASE BLOCKED", mono(29, True), OPEN + (al,), sp=3.5)
                track_sh(d, (1424, 666), "UNTIL REVIEW", mono(29, True), OPEN + (al,), sp=3.5)

        if beat == "r06" and t > 1.9:
            k = ease((t - 1.9)/0.45)
            track(d, (W - M, 210), "ONE ANCHOR", mono(28), INK + (int(232*k),), sp=4.5, anchor="rs")

    elif beat == "sys":
        from sourcesC import RULES
        if t > 0.15:
            hairline(d, M, 250, 700, (t - 0.15)/0.5)
        for i, (num, name, status) in enumerate(RULES):
            dl = 0.35 + i*0.20
            if t < dl: continue
            k = ease((t - dl)/0.35); al = int(236*k)
            y = 312 + i*61
            track_sh(d, (M, y), num, mono(28), DIM + (al,), sp=4.0)
            d.text((M + 86, y + 2), name, font=inter(38, "Medium"), fill=SHADOW + (int(0.7*al),), anchor="ls")
            d.text((M + 84, y), name, font=inter(38, "Medium"), fill=INK + (al,), anchor="ls")
            col = AMBER if status == "PROTOTYPE TARGET" else DIM
            track_sh(d, (M + 1044, y), status, mono(23), col + (int(226*k),), sp=3.0)
        if t > 2.1:
            k = ease((t - 2.1)/0.5)
            d.text((M, 762), "ONE SYSTEM", font=inter(104), fill=INK + (int(255*k),), anchor="ls")
        if t > 3.0:
            k = ease((t - 3.0)/0.5)
            d.text((M, 846), "THE REQUIREMENTS ARE THE PRODUCT.",
                   font=inter(44, "Medium"), fill=DIM + (int(238*k),), anchor="ls")
        if t > 4.0:
            k = ease((t - 4.0)/0.5); al = int(236*k)
            d.rectangle([M, H-M-34, M+3, H-M], fill=AMBER + (al,))
            track(d, (M+22, H-M-6), "RESULT REVEAL / VISUAL INTENTION ONLY",
                  mono(26, True), AMBER + (al,), sp=4.0)
        box = (0, 180, 1500, H)

    elif beat == "end":
        fade = 1.0 if t < dur - 0.9 else max(0.0, (dur - t)/0.9)
        if t > 0.3:
            k = ease((t - 0.3)/0.5) * fade
            track(d, (W//2, 500), "OPEN RANGE INTERACTIVE", inter(46), INK + (int(255*k),),
                  sp=9.0, anchor="ms")
        if t > 0.9:
            k = ease((t - 0.9)/0.5) * fade
            track(d, (W//2 - 250, 566), "FALLS PARK, SIOUX FALLS",
                  mono(25), DIM + (int(215*k),), sp=5.0)
        if t > 1.5:
            k = ease((t - 1.5)/0.5) * fade
            track(d, (W//2 - 300, 646), "VISUAL INTENTION ONLY",
                  mono(25, True), AMBER + (int(228*k),), sp=5.0)
        box = (0, 380, W, 760)

    if box is None:
        return np.zeros((H, W, 4), np.float32), np.zeros((H, W, 4), np.float32)
    base, dark = scrim(img, box)
    return base, dark
