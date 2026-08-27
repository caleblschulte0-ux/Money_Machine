#!/usr/bin/env python3
"""DEMO 2 "WHAT STOOD HERE" -- picture build.

The chain per beat, and it is always the same chain, because that IS the
demonstration:

    the wearer looks
 -> a reticle CONVERGES on the ground the thing occupied
 -> a SCAN outline is taken from the footage's own pixels, so it hugs the real
    rock and the real bank
 -> the reconstruction ASSEMBLES from the ground up, luminous, dimming the
    world behind it the way a head-up display would
 -> a label ANCHORS to the site and tracks it while the camera moves

ChatGPT's r63 note was that causality is missing -- that the earlier films
showed effects without showing what triggers them, and that a reconstruction
can read as a colour grade or a ghost. Every element above exists to answer
that. The reconstruction never simply appears.

The standing rule: AR content is a VISUALISATION and never evidence. The tag
is on screen for the whole of every beat that carries a reconstruction, the
imagery is rendered as structure by ai/holo.py and cannot pass as a
photograph, and no date, measurement or attribution is asserted anywhere.
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
from spec2 import BEATS, PLACES, LABELS, PICK, W, H, FPS

# The last beat that has a clip -- the one whose final frame the end
# card holds. Derived, never typed: renaming or reordering beats in
# spec2 must not silently move the release to the wrong beat.
LAST_BEAT = [b[0] for b in BEATS if b[1] is not None][-1]
import arlabel as AR
import labelkit as LK
import holo
import depthtools as DT
import shotqc
import shotnorm as SN
from native_check import check as native_check

RAWD = "../raw"
OUT = "out2"
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
    """The r60b footage gate. A flagged plate is not cut, full stop."""
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


def draw_label(d, anchor, box_xy, title, sub, k, col=CYAN):
    """Delegates to the shared labelkit. r67's cold-viewer review found
    every film's label too quiet against sky, water and pale stone; the
    fix lives in one place so the five demos cannot drift apart."""
    LK.block(d, anchor, box_xy, title, sub, k, col, W, H)


def frame_cue(d, t, dur):
    cue = ease(min(1.0, t / 0.8)) * (1.0 if t < dur - 0.5 else max(0.0, (dur - t) / 0.5))
    c = int(120 * cue)
    for (x0, y0, x1, y1) in [(64, 64, 150, 67), (64, 64, 67, 150),
                             (W - 150, 64, W - 64, 67), (W - 67, 64, W - 64, 150),
                             (64, H - 67, 150, H - 64), (64, H - 150, 67, H - 64),
                             (W - 150, H - 67, W - 64, H - 64),
                             (W - 67, H - 150, W - 64, H - 64)]:
        d.rectangle([x0, y0, x1, y1], fill=(255, 255, 255, c))


_LAYERS = {}


def layer_for(key):
    if key not in _LAYERS:
        src = cv2.imread(f"{GEN}/{PICK[key]}.jpg")
        if src is None:
            raise SystemExit(f"missing source image for {key}: {GEN}/{PICK[key]}.jpg")
        _LAYERS[key] = holo.reconstruct(src)
    return _LAYERS[key]


# MEMORY. compose() is a GENERATOR and encode() consumes it frame by frame.
# It used to build a full list of finished frames and return it, which meant
# every beat held TWO complete 1920x1080 frame lists at once -- the normalized
# plate and the composed output. A 255-frame beat is 1.58 GB per list, so a
# single render peaked near 3.5 GB and three concurrent renders were killed by
# the cgroup OOM at 7.2 GB RSS (Demo 3, 2026-08-27, silently: the process
# vanished mid-beat and the log just stopped). Streaming halves the peak and
# the input list is dropped as soon as the generator owns it.

SW, SH_ = 960, 540          # working resolution for the depth read
DKEY = 12                   # depth recomputed every DKEY frames and warped


def occlusion_for(frames, places, tracks):
    """Per-beat depth read -> a function(i, place_index) -> HxW occlusion mask.

    r69's single most valuable note was that the reconstructions look
    composited OVER the scene rather than planted IN it, and named
    environmental occlusion as the fix. The depth model already in this repo
    answers it directly: sample the depth at the ground point the structure
    stands on, and anything nearer than that covers it.

    Depth is keyframed, not per-frame -- it is stable on these plates and a
    per-frame read both costs 0.6s a frame and crawls.
    """
    if not places:
        return lambda i, j: None
    keys = {}
    for i in range(0, len(frames), DKEY):
        keys[i] = DT.depth(cv2.resize(frames[i], (SW, SH_), interpolation=cv2.INTER_AREA))
    last = len(frames) - 1
    if last not in keys:
        keys[last] = DT.depth(cv2.resize(frames[last], (SW, SH_),
                                         interpolation=cv2.INTER_AREA))
    ks = sorted(keys)

    def dep_at(i):
        if i in keys:
            return keys[i]
        hi = next(k for k in ks if k > i)
        lo = max(k for k in ks if k < i)
        u = (i - lo) / float(hi - lo)
        return keys[lo] * (1 - u) + keys[hi] * u

    def mask(i, j):
        dmap = dep_at(min(i, len(frames) - 1))
        gx, gy = tracks[j][min(i, len(tracks[j]) - 1)]
        sx = int(np.clip(gx * SW / W, 0, SW - 1))
        sy = int(np.clip(gy * SH_ / H, 0, SH_ - 1))
        # the depth of the GROUND the structure stands on, read over a small
        # patch so one noisy pixel cannot decide what occludes a building
        patch = dmap[max(0, sy - 8):sy + 8, max(0, sx - 8):sx + 8]
        place_d = float(np.median(patch)) if patch.size else float(dmap[sy, sx])
        near = np.clip((dmap - (place_d + 0.045)) * 9.0, 0, 1)
        near = cv2.GaussianBlur(near.astype(np.float32), (0, 0), 2.0)
        return cv2.resize(near, (W, H), interpolation=cv2.INTER_LINEAR)

    return mask


def compose(beat, dur, frames):
    gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]
    places = PLACES.get(beat, [])
    # every reconstruction is anchored to the GROUND POINT it stands on and
    # tracked from there, so it moves with the plate instead of with the screen
    tracks = [AR.track_anchor(gray, (c[0], c[1] + h * 0.5))
              for (_k, c, h, _t0, _bs) in places]
    occl = occlusion_for(frames, places, tracks)
    lab = LABELS.get(beat)
    lpath = AR.track_anchor(gray, lab[0]) if lab else None

    for i, f in enumerate(frames):
        t = i / FPS
        base = f.astype(np.float32)
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)

        for (key, ctr, hgt, t0, bs), path in zip(places, tracks):
            gx, gy = path[min(i, len(path) - 1)]
            cx, cy = gx, gy - hgt * 0.5
            lt = t - t0
            if t < t0 - 0.85:
                continue
            if lt < -0.30:
                # the reticle converging on the ground IS the recognition
                AR.reticle(d, (gx, gy), t - (t0 - 0.85), dur=0.55, a=248)
                continue
            w = LK.outline_weight(lt)
            if w > 0:
                # the scan outline is Canny taken from the plate itself, so it
                # hugs the real bank rather than a shape somebody drew, and it
                # HOLDS at full strength -- r67: it is the evidence the machine
                # saw the object, the label is merely the answer
                m = AR.scan_outline(f, (gx, gy), r=240)
                a = (w * (m / 255.0))[..., None]
                base = base * (1 - a) + np.array(CYAN[::-1], np.float32) * a
            if lt >= 0:
                build = min(1.0, lt / max(0.2, bs))
                k = min(1.0, lt / 0.35)
                lay = layer_for(key)
                j = places.index((key, ctr, hgt, t0, bs))
                # the contact glow is brightest WHILE it assembles and settles
                # to a trace, so the growing-from-a-footprint reads as an event
                fp = (0.35 + 0.65 * (1.0 - build)) * min(1.0, lt / 0.25)
                base = holo.composite(base, lay, holo.fit_rect(lay, (cx, cy), hgt),
                                      k=k, build=build,
                                      occlude=occl(i, j), footprint=fp)
                AR.reticle(d, (gx, gy), 1.0, dur=0.55, a=150)

        if lab and lpath:
            (_, title, sub, t0, off) = lab
            cx, cy = lpath[min(i, len(lpath) - 1)]
            if t >= t0:
                k = ease(min(1.0, (t - t0) / 0.5))
                if k > 0:
                    draw_label(d, (cx, cy), (cx + off[0], cy + off[1]), title, sub, k)

        if places:
            tg = seg(t, places[0][3] - 0.2, places[0][3] + 0.5)
            if tg > 0:
                fn = mono(30)
                s = "VISUAL INTENTION ONLY — RECONSTRUCTION, NOT A PHOTOGRAPH"
                tw = d.textlength(s, font=fn)
                d.rectangle([W / 2 - tw / 2 - 22, H - 116, W / 2 + tw / 2 + 22, H - 70],
                            fill=(6, 9, 12, int(180 * tg)))
                d.text((W / 2, H - 93), s, font=fn, fill=AMBER + (int(246 * tg),),
                       anchor="mm")

        frame_cue(d, t, dur)
        ov = np.array(img).astype(np.float32)
        a = ov[..., 3:4] / 255.0
        out = np.clip(base * (1 - a) + ov[..., :3][..., ::-1] * a, 0, 255)
        # ---- r74 END-CARD RELEASE.
        # The end card is a HELD FRAME of the last beat's final frame, so
        # anything still drawn at that instant is BAKED INTO the brand card.
        # Demo 1 got this fix at r69/r70 and the other four never did: at
        # delivery, Demos 2, 3, 4 and 5 all ended with "OPEN RANGE
        # INTERACTIVE" running straight through a full-strength AR label.
        # ChatGPT saw it on Demo 5 only -- a 4x4 contact sheet does not
        # reliably sample inside a 2.5s end card -- and approved Demo 4
        # as-is while Demo 4 was broken.
        # Releasing the whole COMPOSITE back toward the untouched plate,
        # rather than each element's own alpha, is what makes this
        # complete: it takes the effects blended into `base` (the
        # reconstruction, the depth shells, the class contours) along with
        # the drawn overlay. Per-element release is what let this survive
        # in four films at once.
        # Last beat only. Doing it at every join would fade each beat back
        # to raw footage and change the film.
        if beat == LAST_BEAT:
            rel = min(1.0, max(0.0, (dur - 0.12 - t) / 0.45))
            if rel < 1.0:
                out = out * rel + f.astype(np.float32) * (1.0 - rel)
            # SELF-CHECK, at the one place that can actually prove it.
            # Two attempts to verify this from the finished MP4 both failed
            # and both failed CONFIDENTLY: diffing the end card against the
            # last live frame reports a baked-in overlay as "clean" (nothing
            # changes -- that IS the bug), and the panel scrim is too soft
            # for edge detection to find. Here the untouched plate is in
            # hand, so the invariant is exact rather than inferred: the
            # frame the end card will hold must BE the plate.
            if i == len(frames) - 1:
                assert rel == 0.0 and np.array_equal(out.astype(np.uint8), f), (
                    f"{beat}: the final frame still carries overlay (rel={rel:.4f}). "
                    "The end card holds this frame, so it would be baked in "
                    "behind the wordmark.")
        yield out.astype(np.uint8)


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
    lines = [f"DEMO 2 shot normalization -- common black {tgt['black']:.4f} "
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
    # No filmfinish, for the reason recorded in Demo 1: measured on a plate it
    # cost contrast std 0.271 -> 0.205 and highlights p99 0.916 -> 0.771.
    print("  finish deliberately skipped", flush=True)
