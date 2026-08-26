#!/usr/bin/env python3
"""DEMO 1 "THROUGH THE GLASS" — plates, tracked AR labels, finish.

The overlay is drawn per frame at full resolution and every element is tied to
a tracked anchor, so the label sits on the object rather than on the screen.
That registration is the demonstration; a static caption would prove nothing.
"""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath(".."))
sys.path.insert(0, os.path.abspath("../finish"))
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from spec1 import BEATS, ANCHORS, W, H, FPS
import arlabel as AR
import shotqc
import shotnorm as SN
from native_check import check as native_check
from filmfinish import finish

RAWD = "../raw"; OUT = "out1"
FDIR = "../fonts/inter/extras/ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
INK = (250, 250, 248); DIM = (200, 203, 205); CYAN = (120, 226, 238)
FINISH = dict(grain_amt=0.0, halo=0.09, blm=0.06, ca=0.22,
              vig=0.13, contrast=1.03, weave=0.0, crf=14)


def sh(c):
    r = subprocess.run(c, capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr[-2000:])


def inter(sz, w="SemiBold"): return ImageFont.truetype(f"{FDIR}/Inter-{w}.ttf", sz)
def mono(sz):                return ImageFont.truetype(MONO, sz)


def gate():
    """No segment gets cut without passing. This is the r60b footage gate."""
    bad = []
    for b, clip, tin, st, d, note in BEATS:
        if clip is None: continue
        r = native_check(f"{RAWD}/IMG_{clip}.MOV")
        if not r["ok"]: bad.append(f"{b}: IMG_{clip} would upscale")
        m = shotqc.motion(clip, tin, d, raw=RAWD)
        f = shotqc.flags(m) if m else ["UNMEASURABLE"]
        print(f"  {b:5s} IMG_{clip} @{tin:5.1f} {d:4.1f}s  mot {m['mid']:4.2f} "
              f"tail {m['tail']:4.2f} drift {m['drift']*100:4.1f}% peak {m['peak']:4.1f}"
              f"  {'PASS' if not f else ','.join(f)}", flush=True)
        if f: bad.append(f"{b}: IMG_{clip} @{tin} flags {','.join(f)}")
    if bad: raise SystemExit("FOOTAGE GATE REFUSED:\n  " + "\n  ".join(bad))
    print("  footage gate: all plates pass", flush=True)


def plate(b, clip, tin, d):
    dst = f"{OUT}/{b}_raw.mp4"
    sh(["ffmpeg","-v","error","-y","-ss",str(tin),"-t",f"{d+0.4:.2f}",
        "-i",f"{RAWD}/IMG_{clip}.MOV","-an","-vf",f"scale={W}:{H}",
        "-t",f"{d:.2f}","-r",str(FPS),"-fps_mode","cfr",
        "-c:v","libx264","-crf","12","-pix_fmt","yuv420p",dst])


def read_frames(p):
    dec = subprocess.Popen(["ffmpeg","-v","error","-i",p,"-f","rawvideo",
        "-pix_fmt","bgr24","-"], stdout=subprocess.PIPE)
    n = W*H*3; out = []
    while True:
        b = dec.stdout.read(n)
        if len(b) < n: break
        out.append(np.frombuffer(b, np.uint8).reshape(H, W, 3).copy())
    dec.stdout.close(); dec.wait()
    return out


SHADOW = (5, 8, 10)


def draw_label(d, anchor, box_xy, title, sub, k):
    """A label has to READ. The first pass drew 40px grey on a bright sky and
    it was invisible at any size the operator would actually watch it."""
    ax, ay = anchor; bx, by = box_xy
    al = int(248*k)
    sh = int(150*k)
    d.line([(ax+2, ay+2), (bx+2, by+2)], fill=SHADOW + (sh,), width=4)
    d.line([(ax, ay), (bx, by)], fill=CYAN + (int(228*k),), width=3)
    d.ellipse([ax-9, ay-9, ax+9, ay+9], outline=SHADOW + (sh,), width=5)
    d.ellipse([ax-8, ay-8, ax+8, ay+8], outline=CYAN + (al,), width=3)
    f1, f2 = inter(56), mono(31)
    tw = d.textlength(title, font=f1)
    x0 = bx if bx >= ax else bx - tw
    d.rectangle([x0-20, by-56, x0-15, by+30], fill=SHADOW + (sh,))
    d.rectangle([x0-22, by-58, x0-17, by+28], fill=CYAN + (al,))
    d.text((x0+3, by+3), title, font=f1, fill=SHADOW + (sh,), anchor="ls")
    d.text((x0, by), title, font=f1, fill=INK + (al,), anchor="ls")
    x = x0
    for ch in sub:
        d.text((x+2, by+44), ch, font=f2, fill=SHADOW + (int(190*k),), anchor="ls")
        d.text((x, by+42), ch, font=f2, fill=INK + (int(248*k),), anchor="ls")
        x += d.textlength(ch, font=f2) + 4.0


def compose(beat, dur, frames):
    gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]
    tracks = []
    for (pt, title, sub, t0, off) in ANCHORS.get(beat, []):
        tracks.append((AR.track_anchor(gray, pt), title, sub, t0, off))
    out = []
    for i, f in enumerate(frames):
        t = i/FPS
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        base = f.astype(np.float32)
        for path, title, sub, t0, off in tracks:
            if t < t0 - 0.55: continue
            cx, cy = path[min(i, len(path)-1)]
            lt = t - t0
            if lt < 0:                                   # reticle converging
                AR.reticle(d, (cx, cy), (t - (t0-0.55)), dur=0.55, a=250)
                continue
            if lt < 1.15:                                # scan, from the pixels
                m = AR.scan_outline(f, (cx, cy))
                a = (np.clip(np.sin(min(lt, 1.15)/1.15*np.pi), 0, 1) * (m/255.0))[..., None]
                base = base*(1-a) + np.array(CYAN[::-1], np.float32)*a
            AR.reticle(d, (cx, cy), 1.0, dur=0.55, a=210)
            k = AR.ease(min(1.0, (lt - 0.35)/0.5))
            if k > 0:
                draw_label(d, (cx, cy), (cx+off[0], cy+off[1]), title, sub, k)
        # a quiet frame cue so the viewer reads this as a WEARER'S VIEW
        cue = AR.ease(min(1.0, t/0.8)) * (1.0 if t < dur-0.5 else max(0.0,(dur-t)/0.5))
        c = int(120*cue)
        for (x0,y0,x1,y1) in [(64,64,150,67),(64,64,67,150),
                              (W-150,64,W-64,67),(W-67,64,W-64,150),
                              (64,H-67,150,H-64),(64,H-150,67,H-64),
                              (W-150,H-67,W-64,H-64),(W-67,H-150,W-64,H-64)]:
            d.rectangle([x0,y0,x1,y1], fill=(255,255,255,c))
        ov = np.array(img).astype(np.float32)
        a = ov[..., 3:4]/255.0
        out.append(np.clip(base*(1-a) + ov[..., :3][..., ::-1]*a, 0, 255).astype(np.uint8))
    return out


def encode(frames, dst, crf=13):
    enc = subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo",
        "-pix_fmt","bgr24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-an",
        "-c:v","libx264","-preset","slow","-crf",str(crf),"-pix_fmt","yuv420p",dst],
        stdin=subprocess.PIPE)
    for f in frames: enc.stdin.write(f.tobytes())
    enc.stdin.close(); enc.wait()


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    gate()
    for b, clip, tin, st, d, note in BEATS:
        if clip is None: continue
        plate(b, clip, tin, d)
        print(f"  {b} plate", flush=True)
    # normalization across the five live plates
    live = [b for b in BEATS if b[1]]
    stats = []
    for b, clip, tin, st, d, note in live:
        ims = [read_frames(f"{OUT}/{b}_raw.mp4")[j] for j in (5, 30, 60)]
        s = [SN.measure(SN.deliver_region(i.astype(np.float32)/255.0, aspect=16/9)) for i in ims]
        m = {}
        for k in s[0]:
            v = np.mean([np.asarray(x[k], dtype=np.float64) for x in s], axis=0)
            m[k] = v if getattr(v, "ndim", 0) else float(v)
        stats.append(m)
    tgt, plans = SN.plan(stats)
    lines = [f"DEMO 1 shot normalization -- common black {tgt['black']:.4f} white {tgt['white']:.4f}"]
    for (b, clip, tin, st, d, note), p in zip(live, plans):
        fr = read_frames(f"{OUT}/{b}_raw.mp4")
        nf = [(np.clip(SN.apply(f.astype(np.float32)/255.0, p), 0, 1)*255).astype(np.uint8) for f in fr]
        ov = compose(b, d, nf)
        encode(ov, f"{OUT}/{b}_t.mp4")
        lines.append(f"  {b}  IMG_{clip} @{tin:.1f}s  {SN.describe(p)}")
        print(f"  {b} normalized + AR ({len(ov)} frames)", flush=True)
    open(f"{OUT}/norm.txt","w").write("\n".join(lines)+"\n")
    # No filmfinish pass. Measured on b1 it cost contrast std 0.271 -> 0.205
    # and highlights p99 0.916 -> 0.771: a film shoulder on a product demo,
    # which made the whole thing look hazy. The normalized plate is the
    # deliverable picture.
    print("  finish deliberately skipped -- see comment", flush=True)
