#!/usr/bin/env python3
"""DEMO 4 "DEEP TIME" -- picture build.

Every AR element here is a MEASUREMENT of the plate:
  depth shells and the range sweep come from Depth Anything V2 Small,
  material classes come from Lab colour plus that depth,
  and the subsurface aperture's layer angle comes from the depth gradient at
  the anchor, so the bands lie along the real ground plane instead of across
  the screen.
The one thing that is not measured -- what is under the ground -- is the one
thing labelled VISUALISATION, on screen, for the whole beat.

Segmentation is computed ONCE per beat and then TRACKED by the plate's own
global motion. Recomputing it per frame made the outlines crawl, which reads
as an artefact; segmenting once and following it is also the honest
description of what such a system does.
"""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath(".."))
sys.path.insert(0, os.path.abspath("../finish"))
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from spec4 import BEATS, LABELS, APERTURE, W, H, FPS
import arlabel as AR
import labelkit as LK
import terrain as T
import deep as DP
import depthtools as DT
import shotqc
import shotnorm as SN
from native_check import check as native_check

RAWD = "../raw"; OUT = "out4"
FDIR = "../fonts/inter/extras/ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
INK = (250, 250, 248); CYAN = (120, 226, 238); SHADOW = (5, 8, 10)
AMBER = (250, 206, 128)
SW, SH_ = 960, 540              # working resolution for depth and classes
DKEY = 10                       # depth recomputed every DKEY frames, lerped


def sh(c):
    r = subprocess.run(c, capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr[-2000:])


def inter(sz, w="SemiBold"): return ImageFont.truetype(f"{FDIR}/Inter-{w}.ttf", sz)
def mono(sz):                return ImageFont.truetype(MONO, sz)


def gate():
    """Same footage gate as Demo 1. A flagged plate is not cut, full stop."""
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
    sh(["ffmpeg","-v","error","-y","-ss",str(tin),"-t",f"{d+0.4:.2f}",
        "-i",f"{RAWD}/IMG_{clip}.MOV","-an","-vf",f"scale={W}:{H}",
        "-t",f"{d:.2f}","-r",str(FPS),"-fps_mode","cfr",
        "-c:v","libx264","-crf","12","-pix_fmt","yuv420p", f"{OUT}/{b}_raw.mp4"])


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


def ease(x): return AR.ease(x)
def seg(t, a, b): return ease((t - a) / (b - a)) if b > a else 0.0


def global_track(gray):
    """Cumulative translation of the plate, in working-resolution pixels.
    phaseCorrelate windows its inputs IN PLACE -- hence the copies."""
    small = [cv2.resize(g, (SW, SH_), interpolation=cv2.INTER_AREA).astype(np.float32)
             for g in gray]
    win = cv2.createHanningWindow((SW, SH_), cv2.CV_32F)
    cum = [(0.0, 0.0)]
    x = y = 0.0
    for a, b in zip(small[:-1], small[1:]):
        (dx, dy), _ = cv2.phaseCorrelate(a.copy(), b.copy(), win)
        x += dx; y += dy
        cum.append((x, y))
    return cum


def warp(img, dxy, flags=cv2.INTER_LINEAR):
    M = np.float32([[1, 0, dxy[0]], [0, 1, dxy[1]]])
    return cv2.warpAffine(img, M, (img.shape[1], img.shape[0]), flags=flags,
                          borderMode=cv2.BORDER_REPLICATE)


def depth_track(frames, cum):
    """Depth keyframes every DKEY frames; between them, lerp. Each key is
    computed on its own frame, so a slow pan does not smear the model."""
    keys = {}
    for i in range(0, len(frames), DKEY):
        keys[i] = DT.depth(cv2.resize(frames[i], (SW, SH_), interpolation=cv2.INTER_AREA))
    last = max(keys)
    if last != len(frames) - 1:
        keys[len(frames)-1] = DT.depth(cv2.resize(frames[-1], (SW, SH_),
                                                  interpolation=cv2.INTER_AREA))
    ks = sorted(keys)
    def at(i):
        if i in keys: return keys[i]
        hi = next(k for k in ks if k > i)
        lo = max(k for k in ks if k < i)
        u = (i - lo) / float(hi - lo)
        return keys[lo] * (1 - u) + keys[hi] * u
    return at


def draw_label(d, anchor, box_xy, title, sub, k, col=CYAN):
    """Delegates to the shared labelkit. r67's cold-viewer review found
    every film's label too quiet against sky, water and pale stone; the
    fix lives in one place so the five demos cannot drift apart."""
    return LK.block(d, anchor, box_xy, title, sub, k, col, W, H)


def clamp_text(x, y, w, h, pad=96):
    return (min(max(x, pad + w/2), W - pad - w/2),
            min(max(y, pad + h/2), H - pad - h/2))


def frame_cue(d, t, dur):
    cue = ease(min(1.0, t/0.8)) * (1.0 if t < dur-0.5 else max(0.0, (dur-t)/0.5))
    c = int(120*cue)
    for (x0,y0,x1,y1) in [(64,64,150,67),(64,64,67,150),
                          (W-150,64,W-64,67),(W-67,64,W-64,150),
                          (64,H-67,150,H-64),(64,H-150,67,H-64),
                          (W-150,H-67,W-64,H-64),(W-67,H-150,W-64,H-64)]:
        d.rectangle([x0,y0,x1,y1], fill=(255,255,255,c))


# ---------------------------------------------------------------- the beats
# Each beat has ONE dominant behaviour and its own schedule. Written out per
# beat rather than as one generic driver, because the whole point of the film
# is that these three readings look and behave differently from each other.

SCHED = {
  # r69: b1 is now 4.5s and carries ONE decisive sweep rather than a slow
  # contour build. b3 is 11.0s so the aperture -- the film's clearest proof --
  # has room to open, fill and be read. b4 drops the aperture entirely and
  # runs two systems, because three fully active at once read as clutter.
  "b1": dict(shells=(0.10, 0.80), sweep=(1.00, 3.90), classes=None, ap=None),
  "b2": dict(shells=(0.10, 1.10), sweep=None, classes=(0.20, 2.00), ap=None),
  "b3": dict(shells=(0.20, 1.20), sweep=None, classes=None, ap=(1.60, 3.40)),
  "b4": dict(shells=(0.10, 0.90), sweep=(1.20, 4.40), classes=(0.40, 1.90),
             ap=None),
}


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
    cum = global_track(gray)
    dep_at = depth_track(frames, cum)
    sch = SCHED.get(beat, {})

    # classes: segmented ONCE, then tracked
    cls0 = None
    regs = []
    if sch.get("classes"):
        cls0 = T.classify(cv2.resize(frames[0], (SW, SH_), interpolation=cv2.INTER_AREA),
                          dep_at(0))
        for c, m, cent, frac in T.regions(cls0)[:4]:
            px, py, rad = T.inner_point(m)
            regs.append(dict(c=c, mask=m, pt=(px, py), rad=rad, frac=frac))

    # tracked anchors
    lab = LABELS.get(beat)
    lpath = AR.track_anchor(gray, lab[0]) if lab else None
    ap = APERTURE.get(beat)
    apath = AR.track_anchor(gray, ap[0]) if ap else None
    ap_ang = None

    for i, f in enumerate(frames):
        t = i / FPS
        base = f.astype(np.float32)
        dxy = cum[min(i, len(cum)-1)]
        dep = dep_at(min(i, len(frames)-1))
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)

        # ---- depth shells: the standing 3-D read, revealed near -> far
        if sch.get("shells"):
            a0, a1 = sch["shells"]
            k = seg(t, a0, a1)
            if k > 0:
                e = T.band_edges(dep, 7)
                # reveal sweeps from near (depth 1) to far (depth 0)
                gate_d = 1.0 - k * 1.25
                e = e * np.clip((dep - gate_d) * 8.0, 0, 1)
                hold = 0.46 if beat != "b1" else (0.62 if t < sch["sweep"][0] else 0.34)
                m = cv2.resize(e, (W, H))[..., None] * hold
                base = base*(1-m) + np.array(CYAN[::-1], np.float32)*m

        # ---- the range sweep: one iso-depth surface travelling through the scene
        if sch.get("sweep"):
            s0, s1 = sch["sweep"]
            if s0 <= t <= s1 + 0.35:
                u = np.clip((t - s0) / (s1 - s0), 0, 1)
                lvl = 0.86 - 0.74 * u                       # near -> far
                fade = 1.0 if t <= s1 else max(0.0, 1 - (t - s1)/0.35)
                # The sweep also DIMS everything that is not at its depth.
                # Drawn as light alone it was invisible against sunlit rock;
                # a plane of attention has to take the rest of the frame down
                # with it, which is what a head-up display would really do.
                sm = T.sweep_mask(dep, lvl, 0.050)
                big = cv2.resize(sm, (W, H))[..., None]
                base = base * (1.0 - 0.34 * fade * (1.0 - big))
                m = big * 0.95 * fade
                base = base*(1-m) + np.array([252, 250, 248], np.float32)*m
                # a scale, so the sweep reads as a measurement and not a shine
                # the scale sits INSIDE the frame with a plate behind it; at
                # W-108 with no backing it was clipped and unreadable
                bx = W - 190
                fm = mono(26)
                d.rectangle([bx-56, 128, bx+150, H-128], fill=(6, 9, 12, int(120*fade)))
                d.rectangle([bx-2, 176, bx+18, H-176], outline=CYAN+(int(190*fade),), width=2)
                yy = 176 + (H-352) * u
                d.rectangle([bx-18, yy-4, bx+36, yy+4], fill=CYAN+(int(245*fade),))
                d.text((bx+8, 156), "NEAR", font=fm, fill=INK+(int(235*fade),), anchor="mt")
                d.text((bx+8, H-156), "FAR", font=fm, fill=INK+(int(235*fade),), anchor="mb")

        # ---- material classes: outlines drawn in, then named
        if sch.get("classes") and regs:
            c0, c1 = sch["classes"]
            k = seg(t, c0, c1)
            if k > 0:
                for j, r in enumerate(regs):
                    m = warp(r["mask"], dxy, cv2.INTER_NEAREST)
                    col = T.CLASS_COL[r["c"]]
                    kk = np.clip((k - j*0.12) / 0.6, 0, 1)
                    if kk <= 0: continue
                    for pts in T.outline(m, W, H):
                        cut = max(3, int(len(pts) * kk))
                        d.line(pts[:cut] + ([pts[0]] if cut >= len(pts) else []),
                               fill=col + (int(205*kk),), width=3, joint="curve")
                    # a low wash so the class reads as a region, not a border
                    if kk > 0.6:
                        wm = cv2.resize(m.astype(np.float32), (W, H))[..., None] * 0.085 * kk
                        base = base*(1-wm) + np.array(col[::-1], np.float32)*wm
                    tk = seg(t, c0 + 0.9 + j*0.45, c0 + 1.5 + j*0.45)
                    if tk > 0:
                        nm = T.CLASS_NAME[r["c"]]
                        fn = mono(32)
                        tw = d.textlength(nm, font=fn)
                        px = r["pt"][0]*(W/SW) + dxy[0]*(W/SW)
                        py = r["pt"][1]*(H/SH_) + dxy[1]*(H/SH_)
                        px, py = clamp_text(px, py, tw, 34)
                        d.text((px+2, py+2), nm, font=fn, fill=SHADOW+(int(170*tk),), anchor="mm")
                        d.text((px, py), nm, font=fn, fill=col+(int(245*tk),), anchor="mm")

        # ---- the subsurface aperture
        if ap and apath:
            (a_pt, a_r, a_t) = ap
            cx, cy = apath[min(i, len(apath)-1)]
            if ap_ang is None and t >= a_t - 0.6:
                ap_ang = DP.ground_angle(dep, (cx*SW/W, cy*SH_/H))
            if t >= a_t - 0.75:
                lt = t - a_t
                if lt < 0:
                    AR.reticle(d, (cx, cy), t - (a_t - 0.75), dur=0.75, a=245)
                else:
                    i0, i1 = sch["ap"]
                    k = seg(t, i0, i1)
                    rev = seg(t, i0 + 0.6, i1 + 2.0)
                    base = DP.aperture(base, (cx, cy), a_r, k,
                                       angle=ap_ang or 0.0, reveal=rev)
                    DP.rim(d, (cx, cy), a_r, k)
                    # each material name is LED OUT FROM ITS OWN BAND. The
                    # first build stacked them in a corner legend, which reads
                    # as an interface pasted over the shot rather than as a
                    # reading of the ground in front of you.
                    fn = mono(29)
                    right = cx + a_r*1.30 + 360 < W - 60
                    # Lay the four names out as a COLUMN first, then draw. The
                    # per-band y positions collide -- SIOUX QUARTZITE landed on
                    # top of QUARTZITE / MASSIVE in the still test -- so the
                    # column is de-collided with a minimum gap before anything
                    # is committed to the frame.
                    rows = []
                    for j, (nm, col, hgt) in enumerate(DP.BANDS):
                        bxp, byp = DP.band_anchor((cx, cy), a_r, k, ap_ang or 0.0, j)
                        rows.append([nm, col, bxp, byp, byp])
                    GAP = 46.0
                    for j in range(1, len(rows)):
                        rows[j][4] = max(rows[j][4], rows[j-1][4] + GAP)
                    shift = 0.0
                    if rows and rows[-1][4] > H - 140: shift = (H - 140) - rows[-1][4]
                    for j, (nm, col, bxp, byp, ty0) in enumerate(rows):
                        tk = seg(t, i0 + 1.0 + j*0.30, i0 + 1.5 + j*0.30)
                        if tk <= 0: continue
                        ty = min(max(ty0 + shift, 120.0), H - 120.0)
                        tw2 = d.textlength(nm, font=fn)
                        tx = bxp + (a_r*0.40 if right else -(a_r*0.40 + tw2 + 34))
                        tx = min(max(tx, 70.0), W - 70.0 - tw2)
                        d.rectangle([tx-14, ty-20, tx+tw2+14, ty+20],
                                    fill=(6, 9, 12, int(150*tk)))
                        d.line([(bxp+2, byp+2), (tx-20+2, ty+2)], fill=SHADOW+(int(140*tk),), width=3)
                        d.line([(bxp, byp), (tx-20, ty)], fill=col[::-1] + (int(220*tk),), width=2)
                        d.ellipse([bxp-6, byp-6, bxp+6, byp+6], fill=col[::-1] + (int(240*tk),))
                        d.text((tx, ty), nm, font=fn, fill=INK+(int(248*tk),), anchor="lm")

        # ---- the capability label, tracked
        if lab and lpath:
            (_, title, sub, t0, off) = lab
            cx, cy = lpath[min(i, len(lpath)-1)]
            if t >= t0 - 0.55:
                lt = t - t0
                if lt < 0:
                    AR.reticle(d, (cx, cy), t - (t0-0.55), dur=0.55, a=250)
                else:
                    AR.reticle(d, (cx, cy), 1.0, dur=0.55, a=205)
                    k = ease(min(1.0, (lt - 0.30)/0.5))
                    if k > 0:
                        draw_label(d, (cx, cy), (cx+off[0], cy+off[1]), title, sub, k)

        # ---- the standing honesty tag, whenever ground is opened
        if ap:
            tg = seg(t, ap[2] + 0.2, ap[2] + 0.9)
            if tg > 0:
                fn = mono(30)
                s = "VISUAL INTENTION ONLY — SUBSURFACE NOT PHOTOGRAPHED"
                tw2 = d.textlength(s, font=fn)
                d.rectangle([W/2-tw2/2-22, H-116, W/2+tw2/2+22, H-70],
                            fill=(6, 9, 12, int(180*tg)))
                d.text((W/2, H-93), s, font=fn, fill=AMBER+(int(246*tg),), anchor="mm")

        frame_cue(d, t, dur)
        ov = np.array(img).astype(np.float32)
        a = ov[..., 3:4]/255.0
        yield np.clip(base*(1-a) + ov[..., :3][..., ::-1]*a, 0, 255).astype(np.uint8)


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
    live = [b for b in BEATS if b[1]]
    stats = []
    for b, clip, tin, st, d, note in live:
        fr = read_frames(f"{OUT}/{b}_raw.mp4")
        ims = [fr[j] for j in (5, min(30, len(fr)-1), min(60, len(fr)-1))]
        s = [SN.measure(SN.deliver_region(i.astype(np.float32)/255.0, aspect=16/9)) for i in ims]
        m = {}
        for k in s[0]:
            v = np.mean([np.asarray(x[k], dtype=np.float64) for x in s], axis=0)
            m[k] = v if getattr(v, "ndim", 0) else float(v)
        stats.append(m)
    tgt, plans = SN.plan(stats)
    lines = [f"DEMO 4 shot normalization -- common black {tgt['black']:.4f} white {tgt['white']:.4f}"]
    for (b, clip, tin, st, d, note), p in zip(live, plans):
        fr = read_frames(f"{OUT}/{b}_raw.mp4")
        nf = [(np.clip(SN.apply(f.astype(np.float32)/255.0, p), 0, 1)*255).astype(np.uint8)
              for f in fr]
        encode(compose(b, d, nf), f"{OUT}/{b}_t.mp4")
        del fr, nf
        lines.append(f"  {b}  IMG_{clip} @{tin:.1f}s  {SN.describe(p)}")
        print(f"  {b} normalized + AR", flush=True)
    open(f"{OUT}/norm.txt","w").write("\n".join(lines)+"\n")
    # No filmfinish, for the reason recorded in Demo 1: measured on a plate it
    # cost contrast std 0.271 -> 0.205 and highlights p99 0.916 -> 0.771.
    print("  finish deliberately skipped", flush=True)
