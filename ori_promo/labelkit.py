#!/usr/bin/env python3
"""The AR label, shared by all five demos.

WHY THIS MODULE EXISTS. ChatGPT's r67 cold-viewer review of Demo 1 was
specific and it was right:

  "At 0:04.5 the first label is already present, but it is tiny, pale, and
   pushed into the bright upper-right sky... the labels are readable only when
   actively searched for... In still frames it can read like an editorial
   callout rather than tracked AR because the type is visually detached from
   the ruin."

Every film had its own copy of that too-quiet label, so fixing it once per
film would have meant fixing it five times and drifting four ways. It lives
here now. The changes, each traceable to a line of that review:

  SIZE      title 56 -> 72 (+29%), subtitle 31 -> 34. The review asked for
            25-35% and named thin white type losing against sky, water and
            quartzite as the cause.
  BACKING   a dark translucent scrim behind the block. "Give the label block a
            subtle dark translucent backing or stronger local contrast." A
            drop shadow alone does not survive a bright sky.
  ATTACHMENT a heavier leader and a bigger anchor ring, and callers pull their
            offsets IN. The review's diagnosis of "editorial callout" was
            about distance, not just weight.
  HIERARCHY a `dim` level for an anchor that is already locked, so the
            two-anchor beat has an active label and a settled one instead of
            two labels competing. "Separate the label territories or increase
            hierarchy between the active and already-locked object."

Not changed, deliberately: the number of events. The review was explicit that
five recognitions in 32 seconds is enough and that the answer is bigger
elements, not faster cadence.
"""
from PIL import ImageFont

INK = (250, 250, 248)
SHADOW = (5, 8, 10)
SCRIM = (6, 9, 12)

_FDIR = "../fonts/inter/extras/ttf"
_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

TITLE_PX = 72          # was 56
SUB_PX = 34            # was 31
TAG_PX = 26


def inter(sz, w="Bold"):
    return ImageFont.truetype(f"{_FDIR}/Inter-{w}.ttf", sz)


def mono(sz):
    return ImageFont.truetype(_MONO, sz)


def block(d, anchor, box_xy, title, sub, k, col, W, H,
          tag=None, dim=1.0, sub_col=None, scale=1.0):
    """Draw one tracked label.

    anchor : the point on the object, already tracked
    box_xy : where the label wants to sit; it is clamped into frame
    k      : 0..1 reveal
    dim    : 1.0 for the active label, ~0.62 for one that is already locked
    tag    : optional chip above the title (Demo 5's viewer profiles)
    """
    ax, ay = anchor
    bx, by = box_xy
    a = k * dim
    al = int(250 * a)
    sh = int(165 * a)
    # SCALE, default 1.0 so every existing caller is untouched. It exists
    # because v16 introduced a RECOGNITION label -- the device naming a
    # real waterfall -- alongside the era labels, and at the shared size
    # it crowded the wearer's head (r101). The era labels announce a whole
    # era and have earned their weight; a label that just names what you
    # are already looking at has not, and should sit quieter. Every
    # dimension below is derived from these three, so scaling here scales
    # the scrim, the tick, the leader gap and the sub-line spacing too.
    tpx, spx, gpx = (max(8, int(round(v * scale)))
                     for v in (TITLE_PX, SUB_PX, TAG_PX))
    f1, f2, f3 = inter(tpx), mono(spx), mono(gpx)
    tw = d.textlength(title, font=f1)
    sw = sum(d.textlength(c, font=f2) for c in sub) + 4.0 * max(0, len(sub) - 1)
    x0 = bx if bx >= ax else bx - tw
    x0 = min(max(x0, 92.0), W - 92.0 - max(tw, sw))
    by = min(max(by, 176.0), H - 196.0)

    # THE SCRIM. This is the single biggest legibility win and the reason the
    # earlier labels vanished against sky and whitewater. It is ROUNDED and
    # translucent on purpose: a hard opaque black slab reads as a broadcast
    # lower-third, which is the same "pasted on top" failure r67 flagged in
    # Q3, only louder. Rounded and see-through, the plate still shows under it
    # and it reads as a panel in front of the world rather than a title card.
    wid = max(tw, sw)
    pad = max(10, int(round(26 * scale)))
    box = [x0 - pad, by - tpx - 12 * scale, x0 + wid + pad, by + spx + 24 * scale]
    d.rounded_rectangle(box, radius=14, fill=SCRIM + (int(150 * a),))
    d.rounded_rectangle(box, radius=14, outline=col + (int(72 * a),), width=2)

    # leader and anchor ring -- heavier, because "attached" is the whole claim
    d.line([(ax + 2, ay + 2), (bx + 2, by + 2)], fill=SHADOW + (sh,), width=6)
    d.line([(ax, ay), (bx, by)], fill=col + (int(232 * a),), width=4)
    d.ellipse([ax - 13, ay - 13, ax + 13, ay + 13], outline=SHADOW + (sh,), width=6)
    d.ellipse([ax - 12, ay - 12, ax + 12, ay + 12], outline=col + (al,), width=4)

    if tag:
        cw = d.textlength(tag, font=f3) + 28
        ty = by - tpx - 56 * scale
        d.rectangle([x0 - 4, ty, x0 + cw, ty + 38], fill=col + (int(232 * a),))
        d.text((x0 + 14, ty + 19), tag, font=f3, fill=(8, 11, 14, al), anchor="lm")

    d.rectangle([x0 - 24 * scale, by - tpx + 4, x0 - 18 * scale, by + 30 * scale], fill=SHADOW + (sh,))
    d.rectangle([x0 - 26 * scale, by - tpx + 2, x0 - 20 * scale, by + 28 * scale], fill=col + (al,))
    d.text((x0 + 3, by + 3), title, font=f1, fill=SHADOW + (sh,), anchor="ls")
    d.text((x0, by), title, font=f1, fill=INK + (al,), anchor="ls")

    sc = sub_col or col
    x = x0
    for ch in sub:
        d.text((x + 2, by + spx + 12 * scale), ch, font=f2, fill=SHADOW + (int(200 * a),), anchor="ls")
        d.text((x, by + spx + 10 * scale), ch, font=f2, fill=sc + (int(250 * a),), anchor="ls")
        x += d.textlength(ch, font=f2) + 4.0
    return x0, wid


# How long the derived outline holds at FULL strength before it eases off.
# The review: "Let the derived outline/lock state hold visibly for another
# 0.3-0.5 seconds at full strength. The outline is the evidence that the
# machine saw the object; the label is merely the answer."
OUTLINE_RISE = 0.35
OUTLINE_HOLD = 0.55
OUTLINE_FALL = 0.55


def outline_weight(lt):
    """0..1 envelope for the scan outline, given seconds since the lock."""
    if lt < -OUTLINE_RISE:
        return 0.0
    if lt < 0.0:
        return (lt + OUTLINE_RISE) / OUTLINE_RISE
    if lt < OUTLINE_HOLD:
        return 1.0
    if lt < OUTLINE_HOLD + OUTLINE_FALL:
        return 1.0 - (lt - OUTLINE_HOLD) / OUTLINE_FALL
    return 0.0
