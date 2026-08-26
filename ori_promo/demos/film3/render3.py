#!/usr/bin/env python3
"""DEMO 3 "THEN AND NOW" -- picture build.

THE SEAM IS THE FILM. A vertical boundary sweeps the frame; left of it is the
past, right of it is the present, and the viewer drives it. Three things make
that read as one continuous world rather than as two videos butted together:

  ONE PLATE. The same photographed frame is under both sides. Only the
  treatment changes across the seam, so the rock, the water and the people
  line up perfectly at the boundary -- they are the same pixels.
  THE PAST SIDE IS GRADED, NOT REPLACED. Desaturated and cooled, never
  swapped for other footage. A cut would break the illusion instantly.
  THE SEAM HAS AN EDGE. A bright line with a soft falloff and a slight
  chromatic split, so it reads as an optical boundary being dragged rather
  than as a mask.

And b2 is the argument: the seam goes forward, stops, comes back past where it
started, and goes forward again. Playback cannot do that. Control can.

No dates are asserted anywhere. The scale reads EARLIER and NOW, because we
can stand behind an ordering and cannot stand behind a year.
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath(".."))
sys.path.insert(0, os.path.abspath("../ai"))
sys.path.insert(0, os.path.abspath("../finish"))
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from spec3 import BEATS, PAST, PICK, LABELS, seam_x, W, H, FPS
import arlabel as AR
import holo
import shotqc
import shotnorm as SN
from native_check import check as native_check

RAWD = "../raw"
OUT = "out3"
GEN = "../ai/gen"
FDIR = "../fonts/inter/extras/ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
INK = (250, 250, 248)
CYAN = (120, 226, 238)
AMBER = (250, 206, 128)
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


_X = np.arange(W, dtype=np.float32)[None, :, None]


def past_grade(bgr):
    """The 'earlier' treatment. Cool, desaturated, slightly lifted -- an old
    reading of the SAME pixels, never other footage."""
    g = cv2.cvtColor(bgr.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)[..., None]
    out = bgr * 0.28 + g * 0.72
    out = out * np.float32([1.10, 1.00, 0.90])          # cool it (BGR)
    out = out * 0.80 + 26.0                              # lift, lose the deep black
    return np.clip(out, 0, 255)


def seam_masks(x_frac, soft=26.0):
    """-> (left_weight, edge_weight), both HxWx1 float32."""
    x = x_frac * W
    left = np.clip((x - _X) / soft + 0.5, 0, 1)
    edge = np.clip(1.0 - np.abs(_X - x) / soft, 0, 1)
    return left, edge


def time_scale(d, x_frac, k):
    """The dial. Ends read EARLIER and NOW -- an ordering we can stand behind,
    not a year we cannot."""
    if k <= 0:
        return
    al = int(235 * k)
    y = H - 96
    x0, x1 = 300, W - 300
    f = mono(26)
    d.rectangle([x0 - 150, y - 40, x1 + 150, y + 40], fill=(6, 9, 12, int(150 * k)))
    d.line([(x0, y), (x1, y)], fill=INK + (int(150 * k),), width=2)
    for i in range(11):
        tx = x0 + (x1 - x0) * i / 10.0
        h = 14 if i % 5 else 22
        d.line([(tx, y - h), (tx, y + h)], fill=INK + (int(120 * k),), width=2)
    d.text((x0 - 24, y), "EARLIER", font=f, fill=AMBER + (al,), anchor="rm")
    d.text((x1 + 24, y), "NOW", font=f, fill=CYAN + (al,), anchor="lm")
    hx = x0 + (x1 - x0) * float(np.clip(x_frac, 0, 1))
    d.polygon([(hx, y - 26), (hx + 13, y - 44), (hx - 13, y - 44)], fill=CYAN + (al,))
    d.line([(hx, y - 26), (hx, y + 26)], fill=CYAN + (al,), width=4)


def draw_label(d, anchor, box_xy, title, sub, k, col=CYAN):
    ax, ay = anchor
    bx, by = box_xy
    al = int(248 * k)
    s = int(150 * k)
    f1, f2 = inter(56), mono(31)
    tw = d.textlength(title, font=f1)
    x0 = bx if bx >= ax else bx - tw
    x0 = min(max(x0, 78.0), W - 78.0 - tw)
    by = min(max(by, 130.0), H - 210.0)          # stay clear of the time scale
    d.line([(ax + 2, ay + 2), (bx + 2, by + 2)], fill=SHADOW + (s,), width=4)
    d.line([(ax, ay), (bx, by)], fill=col + (int(228 * k),), width=3)
    d.ellipse([ax - 9, ay - 9, ax + 9, ay + 9], outline=SHADOW + (s,), width=5)
    d.ellipse([ax - 8, ay - 8, ax + 8, ay + 8], outline=col + (al,), width=3)
    d.rectangle([x0 - 20, by - 56, x0 - 15, by + 30], fill=SHADOW + (s,))
    d.rectangle([x0 - 22, by - 58, x0 - 17, by + 28], fill=col + (al,))
    d.text((x0 + 3, by + 3), title, font=f1, fill=SHADOW + (s,), anchor="ls")
    d.text((x0, by), title, font=f1, fill=INK + (al,), anchor="ls")
    x = x0
    for ch in sub:
        d.text((x + 2, by + 44), ch, font=f2, fill=SHADOW + (int(190 * k),), anchor="ls")
        d.text((x, by + 42), ch, font=f2, fill=INK + (int(248 * k),), anchor="ls")
        x += d.textlength(ch, font=f2) + 4.0


def frame_cue(d, t, dur):
    cue = ease(min(1.0, t / 0.8)) * (1.0 if t < dur - 0.5 else max(0.0, (dur - t) / 0.5))
    c = int(120 * cue)
    for (x0, y0, x1, y1) in [(64, 64, 150, 67), (64, 64, 67, 150),
                             (W - 150, 64, W - 64, 67), (W - 67, 64, W - 64, 150),
                             (64, H - 67, 150, H - 64), (64, H - 150, 67, H - 64),
                             (W - 150, H - 67, W - 64, H - 64),
                             (W - 67, H - 150, W - 64, H - 64)]:
        d.rectangle([x0, y0, x1, y1], fill=(255, 255, 255, c))


_LAY = {}


def layer_for(key):
    if key not in _LAY:
        src = cv2.imread(f"{GEN}/{PICK[key]}.jpg")
        if src is None:
            raise SystemExit(f"missing source image for {key}")
        _LAY[key] = holo.reconstruct(src)
    return _LAY[key]


def compose(beat, dur, frames):
    gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]
    past = PAST.get(beat)
    ppath = None
    if past:
        key, ctr, hgt = past
        ppath = AR.track_anchor(gray, (ctr[0], ctr[1] + hgt * 0.5))
    lab = LABELS.get(beat)
    lpath = AR.track_anchor(gray, lab[0]) if lab else None

    out = []
    for i, f in enumerate(frames):
        t = i / FPS
        xf = seam_x(beat, t)
        base = f.astype(np.float32)

        if xf is not None:
            left, edge = seam_masks(xf)
            # the past side is a GRADE of the same pixels, so the two sides
            # register perfectly at the boundary
            base = base * (1 - left) + past_grade(base) * left
            if past:
                key, ctr, hgt = past
                gx, gy = ppath[min(i, len(ppath) - 1)]
                lay = layer_for(key)
                built = np.zeros_like(base)
                built[:] = base
                built = holo.composite(built, lay,
                                       holo.fit_rect(lay, (gx, gy - hgt * 0.5), hgt),
                                       k=1.0, build=1.0)
                base = base * (1 - left) + built * left
            # the seam's own edge: a bright line with a chromatic split, so it
            # reads as an optical boundary being dragged and not as a mask
            base = base + np.float32([210, 235, 250]) * edge * 0.85
            shift = np.roll(base, 3, axis=1)
            base = base * (1 - edge * 0.35) + shift * (edge * 0.35)
            base = np.clip(base, 0, 255)

        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        time_scale(d, 1.0 - (xf if xf is not None else 1.0),
                   ease(min(1.0, t / 0.7)) if xf is not None else 0.0)
        if lab and lpath:
            (_, title, sub, t0, off) = lab
            cx, cy = lpath[min(i, len(lpath) - 1)]
            if t >= t0:
                k = ease(min(1.0, (t - t0) / 0.5))
                if k > 0:
                    draw_label(d, (cx, cy), (cx + off[0], cy + off[1]), title, sub, k)
        if past:
            tg = ease(min(1.0, max(0.0, (t - 0.6) / 0.6)))
            if tg > 0:
                fn = mono(28)
                s = "VISUAL INTENTION ONLY — RECONSTRUCTION, NOT A PHOTOGRAPH"
                tw = d.textlength(s, font=fn)
                d.rectangle([W / 2 - tw / 2 - 20, 96, W / 2 + tw / 2 + 20, 140],
                            fill=(6, 9, 12, int(170 * tg)))
                d.text((W / 2, 119), s, font=fn, fill=AMBER + (int(242 * tg),), anchor="mm")
        frame_cue(d, t, dur)
        ov = np.array(img).astype(np.float32)
        a = ov[..., 3:4] / 255.0
        out.append(np.clip(base * (1 - a) + ov[..., :3][..., ::-1] * a, 0, 255).astype(np.uint8))
    return out


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
    lines = [f"DEMO 3 shot normalization -- common black {tgt['black']:.4f} "
             f"white {tgt['white']:.4f}"]
    for (b, clip, tin, st, d, note), p in zip(live, plans):
        fr = read_frames(f"{OUT}/{b}_raw.mp4")
        nf = [(np.clip(SN.apply(f.astype(np.float32) / 255.0, p), 0, 1) * 255).astype(np.uint8)
              for f in fr]
        ov = compose(b, d, nf)
        encode(ov, f"{OUT}/{b}_t.mp4")
        lines.append(f"  {b}  IMG_{clip} @{tin:.1f}s  {SN.describe(p)}")
        print(f"  {b} normalized + AR ({len(ov)} frames)", flush=True)
    open(f"{OUT}/norm.txt", "w").write("\n".join(lines) + "\n")
    print("  finish deliberately skipped", flush=True)
