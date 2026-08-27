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
from ai import place as PL
import depthtools as DT
from spec_one import BEATS, FIGURES, LABELS, ICE, W, H, FPS, TOTAL

RAW = "../raw"
OUT = "out1"
CYAN = (238, 226, 120)
AMBER = (250, 206, 128)
INK = (250, 250, 248)

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


def ice_grade(bgr, k, depth=None):
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
    # Depth separates him outright on this plate: measured, his head sits at
    # 0.65-0.75 and NOTHING else in frame is above 0.19, so a threshold at
    # 0.40 takes him and touches nothing else. Feathered over 0.06 so the
    # edge of his shoulder does not become a cutout line.
    if depth is not None:
        near = np.clip((depth - 0.40) / 0.06, 0, 1)[..., None]
        iced = iced * (1 - near) + f * near

    return np.clip(f * (1 - k) + iced * k, 0, 255)


def draw_label(d, anchor, box, title, sub, k, col=CYAN):
    LK.block(d, anchor, box, title, sub, k, col, W, H)


def frame_cue(d, t, dur):
    cue = AR.ease(min(1.0, t / 0.8)) * (1.0 if t < dur - 0.5 else max(0.0, (dur - t) / 0.5))
    c = int(115 * cue)
    for (x0, y0, x1, y1) in [(64, 64, 150, 67), (64, 64, 67, 150),
                             (W - 150, 64, W - 64, 67), (W - 67, 64, W - 64, 150),
                             (64, H - 67, 150, H - 64), (64, H - 150, 67, H - 64),
                             (W - 150, H - 67, W - 64, H - 64),
                             (W - 67, H - 150, W - 64, H - 64)]:
        d.rectangle([x0, y0, x1, y1], fill=INK + (c,))


def compose(beat, dur, frames):
    gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]
    figs = FIGURES.get(beat, [])
    lab = LABELS.get(beat)

    # Depth once, from the first frame. The camera pans but the SCENE does
    # not change, so a per-frame depth pass would cost minutes and buy a
    # difference no viewer can see.
    dep0 = DT.depth(frames[0]) if (figs or beat == ICE["beat"]) else None

    # track every figure's foot point and the label anchor with the plate
    fpaths = [AR.track_anchor(gray, f[1]) for f in figs]
    lpath = AR.track_anchor(gray, lab[0]) if lab else None
    cuts = [PL.matte(asset(f[0])) for f in figs]

    icebeat = (beat == ICE["beat"])

    for i, f in enumerate(frames):
        t = i / FPS
        base = f.astype(np.float32)

        if icebeat:
            a0, a1 = ICE["in"]
            base = ice_grade(base.astype(np.uint8),
                             AR.ease(min(1.0, max(0.0, (t - a0) / (a1 - a0)))),
                             depth=dep0)

        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)

        for (src, _fx, hpx, t0, build, sdep, mtch), path, cut in zip(figs, fpaths, cuts):
            foot = path[min(i, len(path) - 1)]
            lt = t - t0
            if lt < -0.55:
                continue
            if lt < 0:
                AR.reticle(d, (foot[0], foot[1] - hpx * 0.5), t - (t0 - 0.55),
                           dur=0.55, col=CYAN, a=235)
                continue
            k = min(1.0, lt / build)
            base = PL.place(base, cut, foot, hpx, k=k, depth=dep0,
                            subj_depth=sdep, reveal=(k < 1.0), match=mtch)

        if lab and lpath:
            (_, title, sub, t0, off) = lab
            cx, cy = lpath[min(i, len(lpath) - 1)]
            if t >= t0:
                k = AR.ease(min(1.0, (t - t0) / 0.5))
                k *= min(1.0, max(0.0, (dur - 0.12 - t) / 0.45))
                if k > 0:
                    draw_label(d, (cx, cy), (cx + off[0], cy + off[1]), title, sub, k)

        # the standing honesty tag, on any beat that puts a figure in frame
        if figs:
            tg = AR.ease(min(1.0, max(0.0, (t - 0.8) / 0.6)))
            tg *= min(1.0, max(0.0, (dur - 0.12 - t) / 0.45))
            if tg > 0:
                fn = mono(28)
                s = "VISUALISATION — NOT A PHOTOGRAPH"
                tw = d.textlength(s, font=fn)
                d.rectangle([W / 2 - tw / 2 - 20, 96, W / 2 + tw / 2 + 20, 140],
                            fill=(6, 9, 12, int(165 * tg)))
                d.text((W / 2, 119), s, font=fn, fill=AMBER + (int(240 * tg),),
                       anchor="mm")

        frame_cue(d, t, dur)
        ov = np.array(img).astype(np.float32)
        a = ov[..., 3:4] / 255.0
        out = np.clip(base * (1 - a) + ov[..., :3][..., ::-1] * a, 0, 255)

        # END-CARD RELEASE (r74's invariant, kept). The end card holds the
        # last beat's final composed frame, so anything still drawn then is
        # baked in behind the wordmark.
        if beat == LAST_BEAT:
            rel = min(1.0, max(0.0, (dur - 0.12 - t) / 0.45))
            if rel < 1.0:
                out = out * rel + f.astype(np.float32) * (1.0 - rel)
            if i == len(frames) - 1:
                assert rel == 0.0 and np.array_equal(out.astype(np.uint8), f), (
                    f"{beat}: final frame still carries overlay (rel={rel:.4f})")
        yield out.astype(np.uint8)


def encode(gen, dst, crf=13):
    enc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
         "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p", dst],
        stdin=subprocess.PIPE)
    for fr in gen:
        enc.stdin.write(fr.tobytes())
    enc.stdin.close()
    enc.wait()


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

    for (b, c, tin, dur), p in zip(rows, params):
        if only and b not in only:
            continue
        fr = [(np.clip(shotnorm.apply(f.astype(np.float32) / 255.0, p), 0, 1) * 255
               ).astype(np.uint8) for f in frames_of(c, tin, dur)]
        encode(compose(b, dur, fr), f"{OUT}/{b}_t.mp4")
        del fr
        print(f"  {b} composed", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:] or None)
