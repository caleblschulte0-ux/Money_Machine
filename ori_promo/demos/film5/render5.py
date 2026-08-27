#!/usr/bin/env python3
"""DEMO 5 "THE TOUR" -- picture build.

Everything here answers one question: how do you SHOW that two people wearing
these are seeing different things, without cutting the frame in half?

  COLOUR IS THE SYSTEM. Viewer A's content is cyan and tagged A; viewer B's is
  amber and tagged B. They coexist in one image. A third person watching can
  say what is happening without being told.
  THE PIN IS THE PROOF. A marks something, the mark travels on an arc, and it
  arrives in B's colour with B's label attached. Two views, one object, one
  hand-off -- and it happens IN the shot, not in a cut.
  THE CAPABILITY LABEL IS WHITE, so it belongs to neither viewer and reads as
  the film talking rather than as a third profile.

Every anchor is tracked with Lucas-Kanade against the plate, so both viewers'
content stays on its object while the camera moves. That registration is the
demonstration; two captions sitting still on the screen would prove nothing.
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath(".."))
sys.path.insert(0, os.path.abspath("../finish"))
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from spec5 import BEATS, MARKS, HANDOFF, LABELS, PROFILES, W, H, FPS
import arlabel as AR
import labelkit as LK
import shotqc
import shotnorm as SN
from native_check import check as native_check

RAWD = "../raw"
OUT = "out5"
FDIR = "../fonts/inter/extras/ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
INK = (250, 250, 248)
SHADOW = (5, 8, 10)


def sh(c):
    r = subprocess.run(c, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-2000:])


def inter(sz, w="SemiBold"):
    return ImageFont.truetype(f"{FDIR}/Inter-{w}.ttf", sz)


def mono(sz):
    return ImageFont.truetype(MONO, sz)


def gate():
    bad = []
    for b, clip, tin, st, d, note in BEATS:
        if clip is None:
            continue
        r = native_check(f"{RAWD}/IMG_{clip}.MOV")
        if not r["ok"]:
            bad.append(f"{b}: IMG_{clip} would upscale")
        m = shotqc.motion(clip, tin, d, raw=RAWD)
        f = shotqc.flags(m) if m else ["UNMEASURABLE"]
        print(f"  {b:5s} IMG_{clip} @{tin:5.1f} {d:4.1f}s  mot {m['mid']:4.2f} "
              f"tail {m['tail']:4.2f} drift {m['drift']*100:4.1f}% peak {m['peak']:4.1f}"
              f"  {'PASS' if not f else ','.join(f)}", flush=True)
        if f:
            bad.append(f"{b}: IMG_{clip} @{tin} flags {','.join(f)}")
    if bad:
        raise SystemExit("FOOTAGE GATE REFUSED:\n  " + "\n  ".join(bad))
    print("  footage gate: all plates pass", flush=True)


def plate(b, clip, tin, d):
    sh(["ffmpeg", "-v", "error", "-y", "-ss", str(tin), "-t", f"{d+0.4:.2f}",
        "-i", f"{RAWD}/IMG_{clip}.MOV", "-an", "-vf", f"scale={W}:{H}",
        "-t", f"{d:.2f}", "-r", str(FPS), "-fps_mode", "cfr",
        "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", f"{OUT}/{b}_raw.mp4"])


def read_frames(p):
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", p, "-f", "rawvideo",
                            "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    n = W * H * 3
    out = []
    while True:
        b = dec.stdout.read(n)
        if len(b) < n:
            break
        out.append(np.frombuffer(b, np.uint8).reshape(H, W, 3).copy())
    dec.stdout.close()
    dec.wait()
    return out


def ease(x):
    return AR.ease(x)


def seg(t, a, b):
    return ease((t - a) / (b - a)) if b > a else 0.0


def tag_label(d, anchor, box_xy, title, sub, k, col, tag=None):
    """Delegates to the shared labelkit. r67's cold-viewer review found
    every film's label too quiet against sky, water and pale stone; the
    fix lives in one place so the five demos cannot drift apart."""
    LK.block(d, anchor, box_xy, title, sub, k, col, W, H, tag=tag)


def pin(d, xy, k, col, size=22):
    """The mark itself: a diamond with a stem, so it reads as PLACED on the
    ground rather than floating at the camera."""
    x, y = xy
    s = size * (0.4 + 0.6 * k)
    al = int(250 * k)
    d.line([(x, y), (x, y - s * 2.1)], fill=SHADOW + (int(150 * k),), width=5)
    d.line([(x, y), (x, y - s * 2.0)], fill=col + (al,), width=3)
    top = y - s * 2.0
    d.polygon([(x, top - s), (x + s * 0.8, top), (x, top + s), (x - s * 0.8, top)],
              fill=col + (al,))
    d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=col + (al,))


def arc_point(p0, p1, u, lift=0.34):
    """A quadratic arc between the two viewers. A straight line between two
    points in a photograph reads as a diagram; an arc reads as something
    being handed over."""
    mx = (p0[0] + p1[0]) / 2.0
    my = min(p0[1], p1[1]) - abs(p1[0] - p0[0]) * lift
    a = (1 - u) ** 2
    b = 2 * (1 - u) * u
    c = u ** 2
    return (a * p0[0] + b * mx + c * p1[0], a * p0[1] + b * my + c * p1[1])


def roster(d, k, names):
    """Who is connected. Bottom left, small, with a plate behind it.

    The first version used a fixed 430px plate and right-aligned the count
    inside it, so with two viewers the names ran straight through the count
    and it rendered as "VIEWER A  VIEWERNECTED". Everything is measured now
    and the plate is sized to what it actually has to hold.
    """
    if k <= 0 or not names:
        return
    f = mono(26)
    fc = mono(22)
    y = H - 96
    count = f"{len(names)} CONNECTED"
    DOT, GAPD, GAPI, PAD = 18, 12, 34, 22
    wid = sum(DOT + GAPD + d.textlength(t, font=f) + GAPI for t, _ in names)
    wid += d.textlength(count, font=fc) + 16
    x0 = 70
    d.rectangle([x0, y - 30, x0 + wid + PAD * 2, y + 34], fill=(6, 9, 12, int(150 * k)))
    x = x0 + PAD
    for tag, col in names:
        d.ellipse([x, y - 9, x + DOT, y + 9], fill=col + (int(245 * k),))
        x += DOT + GAPD
        d.text((x, y), tag, font=f, fill=INK + (int(242 * k),), anchor="lm")
        x += d.textlength(tag, font=f) + GAPI
    d.text((x, y), count, font=fc, fill=INK + (int(190 * k),), anchor="lm")


def frame_cue(d, t, dur):
    cue = ease(min(1.0, t / 0.8)) * (1.0 if t < dur - 0.5 else max(0.0, (dur - t) / 0.5))
    c = int(120 * cue)
    for (x0, y0, x1, y1) in [(64, 64, 150, 67), (64, 64, 67, 150),
                             (W - 150, 64, W - 64, 67), (W - 67, 64, W - 64, 150),
                             (64, H - 67, 150, H - 64), (64, H - 150, 67, H - 64),
                             (W - 150, H - 67, W - 64, H - 64),
                             (W - 67, H - 150, W - 64, H - 64)]:
        d.rectangle([x0, y0, x1, y1], fill=(255, 255, 255, c))


# MEMORY. compose() is a GENERATOR and encode() consumes it frame by frame.
# It used to build a full list of finished frames and return it, which meant
# every beat held TWO complete 1920x1080 frame lists at once -- the normalized
# plate and the composed output. A 255-frame beat is 1.58 GB per list, so a
# single render peaked near 3.5 GB and three concurrent renders were killed by
# the cgroup OOM at 7.2 GB RSS (Demo 3, 2026-08-27, silently: the process
# vanished mid-beat and the log just stopped). Streaming halves the peak and
# the input list is dropped as soon as the generator owns it.

def compose(beat, dur, frames):
    gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]
    marks = MARKS.get(beat, [])
    tracks = [AR.track_anchor(gray, m[1]) for m in marks]
    lab = LABELS.get(beat)
    lpath = AR.track_anchor(gray, lab[0]) if lab else None
    hand = HANDOFF.get(beat)
    hpaths = None
    if hand:
        hpaths = (AR.track_anchor(gray, hand[0]), AR.track_anchor(gray, hand[1]))

    for i, f in enumerate(frames):
        t = i / FPS
        base = f.astype(np.float32)
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        seen = []

        for (prof, pt, title, sub, t0, off), path in zip(marks, tracks):
            P = PROFILES[prof]
            col = P["col"]
            cx, cy = path[min(i, len(path) - 1)]
            if t < t0 - 0.55:
                continue
            lt = t - t0
            if lt < 0:
                AR.reticle(d, (cx, cy), t - (t0 - 0.55), dur=0.55, col=col, a=248)
                continue
            w = LK.outline_weight(lt)
            if w > 0:
                # the scan comes from the plate's own pixels, in the viewer's
                # colour, so even the recognition is attributed to a person
                m = AR.scan_outline(f, (cx, cy), r=190)
                a = (w * (m / 255.0))[..., None]
                base = base * (1 - a) + np.array(col[::-1], np.float32) * a
            AR.reticle(d, (cx, cy), 1.0, dur=0.55, col=col, a=200)
            k = ease(min(1.0, (lt - 0.30) / 0.5))
            if k > 0:
                tag_label(d, (cx, cy), (cx + off[0], cy + off[1]), title, sub, k,
                          col, tag=f"{P['name']} · {P['track']}")
                if (P["name"], col) not in seen:
                    seen.append((P["name"], col))

        if hand and hpaths:
            (p0, p1, t0, secs) = hand
            a0 = hpaths[0][min(i, len(hpaths[0]) - 1)]
            a1 = hpaths[1][min(i, len(hpaths[1]) - 1)]
            if t >= t0:
                u = min(1.0, (t - t0) / secs)
                # the trail, then the pin, then it belongs to B
                col = PROFILES["A"]["col"] if u < 1.0 else PROFILES["B"]["col"]
                pts = [arc_point(a0, a1, uu * u) for uu in np.linspace(0, 1, 26)]
                for j in range(1, len(pts)):
                    al = int(210 * (j / len(pts)) * (1.0 if u < 1.0 else max(0.0, 1 - (t - t0 - secs) / 0.6)))
                    if al <= 2:
                        continue
                    d.line([pts[j - 1], pts[j]], fill=col + (al,), width=3)
                if u < 1.0:
                    pin(d, arc_point(a0, a1, u), 1.0, PROFILES["A"]["col"])
                else:
                    land = ease(min(1.0, (t - t0 - secs) / 0.45))
                    pin(d, a1, land, PROFILES["B"]["col"])
                    if land > 0.3:
                        B = PROFILES["B"]
                        tag_label(d, a1, (a1[0] + 300, a1[1] - 200),
                                  "RECEIVED", "FROM VIEWER A", land, B["col"],
                                  tag=f"{B['name']} · {B['track']}")
                        if (B["name"], B["col"]) not in seen:
                            seen.append((B["name"], B["col"]))

        if lab and lpath:
            (_, title, sub, t0, off) = lab
            cx, cy = lpath[min(i, len(lpath) - 1)]
            if t >= t0:
                k = ease(min(1.0, (t - t0) / 0.5))
                if k > 0:
                    tag_label(d, (cx, cy), (cx + off[0], cy + off[1]), title, sub, k,
                              (250, 250, 248))

        if seen:
            roster(d, ease(min(1.0, (t - 1.0) / 0.6)), seen)

        # ---- the standing honesty tag, whenever two viewers are on screen
        # r72. ChatGPT's r71 review: "RECEIVED FROM VIEWER A", "SAME ANCHOR /
        # DIFFERENT DEPTH" and the "N CONNECTED" roster read as a working
        # multi-user network with shared anchors and synchronised state.
        # Nothing here is networked -- this is one photographed plate with two
        # label tracks drawn on it. The other four films carry a disclosure
        # whenever they show something that is not evidence; this one showed a
        # capability claim with nothing on it at all, which was the gap.
        # Tied to the roster, so it is present for exactly as long as the
        # thing it qualifies.
        if len(seen) > 1:
            tg = ease(min(1.0, (t - 1.4) / 0.6))
            if tg > 0:
                fn = mono(30)
                msg = "MULTI-VIEWER SHOWN AS PRODUCT CONCEPT"
                tw2 = d.textlength(msg, font=fn)
                d.rectangle([W / 2 - tw2 / 2 - 22, H - 178, W / 2 + tw2 / 2 + 22, H - 132],
                            fill=(6, 9, 12, int(180 * tg)))
                d.text((W / 2, H - 155), msg, font=fn,
                       fill=(246, 196, 118) + (int(246 * tg),), anchor="mm")

        frame_cue(d, t, dur)
        ov = np.array(img).astype(np.float32)
        a = ov[..., 3:4] / 255.0
        yield np.clip(base * (1 - a) + ov[..., :3][..., ::-1] * a, 0, 255).astype(np.uint8)


def encode(frames, dst, crf=13):
    enc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo",
                            "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow",
                            "-crf", str(crf), "-pix_fmt", "yuv420p", dst],
                           stdin=subprocess.PIPE)
    for f in frames:
        enc.stdin.write(f.tobytes())
    enc.stdin.close()
    enc.wait()


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    gate()
    for b, clip, tin, st, d, note in BEATS:
        if clip is None:
            continue
        plate(b, clip, tin, d)
        print(f"  {b} plate", flush=True)
    live = [b for b in BEATS if b[1]]
    stats = []
    for b, clip, tin, st, d, note in live:
        fr = read_frames(f"{OUT}/{b}_raw.mp4")
        ims = [fr[j] for j in (5, min(30, len(fr) - 1), min(60, len(fr) - 1))]
        s = [SN.measure(SN.deliver_region(i.astype(np.float32) / 255.0, aspect=16 / 9))
             for i in ims]
        m = {}
        for k in s[0]:
            v = np.mean([np.asarray(x[k], dtype=np.float64) for x in s], axis=0)
            m[k] = v if getattr(v, "ndim", 0) else float(v)
        stats.append(m)
    tgt, plans = SN.plan(stats)
    lines = [f"DEMO 5 shot normalization -- common black {tgt['black']:.4f} "
             f"white {tgt['white']:.4f}"]
    for (b, clip, tin, st, d, note), p in zip(live, plans):
        fr = read_frames(f"{OUT}/{b}_raw.mp4")
        nf = [(np.clip(SN.apply(f.astype(np.float32) / 255.0, p), 0, 1) * 255).astype(np.uint8)
              for f in fr]
        encode(compose(b, d, nf), f"{OUT}/{b}_t.mp4")
        del fr, nf
        lines.append(f"  {b}  IMG_{clip} @{tin:.1f}s  {SN.describe(p)}")
        print(f"  {b} normalized + AR", flush=True)
    open(f"{OUT}/norm.txt", "w").write("\n".join(lines) + "\n")
    print("  finish deliberately skipped", flush=True)
