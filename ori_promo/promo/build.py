#!/usr/bin/env python3
"""ORI promo build. Stages (run in order, each cached in work/):

  python3 build.py prep       # cut + stabilise every shot to work/shots/
  python3 build.py fx         # tracked composites (markers, ice age, mammoth, dakota)
  python3 build.py picture    # concat + grade, then type/UI pass -> work/picture.mp4
  python3 build.py audio      # music + natural sound + sfx (+ optional VO) -> work/mix*.wav
  python3 build.py final      # mux + vignette/grain -> ../out/ORI_promo.mp4 (+ _vo variant)
  python3 build.py all
"""
import json
import math
import os
import subprocess
import sys
import wave

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec import (W, H, FPS, TOTAL, END_CARD_START, SHOTS, CARDS, TAGS, VO,
                  MUSIC, MUSIC_OFFSET, SFX, BRAND, TAGLINE, shot_start)

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
WORK = "work"
SHOTS_DIR = f"{WORK}/shots"
FONTS = "/home/user/Shorts-pipeline/assets/fonts"
os.makedirs(SHOTS_DIR, exist_ok=True)

ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p"]
ACCENT = (255, 190, 90)          # RGB, warm amber -- the one accent
ACCENT_BGR = ACCENT[::-1]
INK = (245, 243, 238)


def run(cmd, **kw):
    print("  $", " ".join(str(c) for c in cmd)[:220])
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def ffprobe_dur(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                 "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip())


def ease(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def ease_out(u):
    u = min(1.0, max(0.0, u))
    return 1 - (1 - u) ** 3


# --------------------------------------------------------------------------- prep

def prep_shot(sid, src, t_in, dur, opt):
    out = f"{SHOTS_DIR}/{sid}.mp4"
    wav = f"{SHOTS_DIR}/{sid}.wav"
    if os.path.exists(out) and os.path.exists(wav):
        print(f"  {sid}: cached")
        return
    n_frames = int(round(dur * FPS))
    if opt.get("still"):
        # slow push on a still, 1.5s, no natural sound
        run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", src, "-t", dur,
             "-vf", f"scale=2400:-1,zoompan=z='1.0+0.06*on/{n_frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},format=yuv420p",
             "-frames:v", n_frames, *ENC, out])
        run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", dur, wav])
        return
    speed = opt.get("speed", 1.0)
    src_dur = dur * speed
    pad = 0.6 if opt.get("stab") else 0.0
    ss = max(0.0, t_in - pad)
    lead = t_in - ss
    seg = f"{WORK}/_seg_{sid}.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-ss", ss, "-i", src, "-t", src_dur + 2 * pad,
         "-vf", f"scale={W}:{H}:flags=lanczos,fps={FPS}", "-an", *ENC, seg])
    vf = []
    if opt.get("stab"):
        trf = f"{WORK}/_{sid}.trf"
        run(["ffmpeg", "-v", "error", "-y", "-i", seg,
             "-vf", f"vidstabdetect=shakiness=6:accuracy=15:stepsize=4:result={trf}", "-f", "null", "-"])
        vf.append(f"vidstabtransform=input={trf}:smoothing=24:zoom={opt.get('zoom', 3)}:optzoom=0:crop=black:interpol=bicubic")
    vf.append(f"trim=start={lead:.4f}:duration={src_dur:.4f},setpts=PTS-STARTPTS")
    if speed != 1.0:
        vf.append(f"minterpolate=fps={FPS/speed:.4f}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,setpts=PTS/{speed}")
    vf.append(f"fps={FPS},scale={W}:{H},tpad=stop_mode=clone:stop_duration=1")
    run(["ffmpeg", "-v", "error", "-y", "-i", seg, "-vf", ",".join(vf), "-frames:v", n_frames, *ENC, out])
    # natural sound, time-stretched if slow-mo
    af = f"atrim=start=0:duration={src_dur:.4f},asetpts=PTS-STARTPTS"
    if speed != 1.0:
        af += f",atempo={speed:.4f}"
    af += f",apad,atrim=duration={dur:.4f}"
    run(["ffmpeg", "-v", "error", "-y", "-ss", t_in, "-i", src, "-t", src_dur + 0.2, "-vn",
         "-af", af, "-ar", "48000", "-ac", "2", wav])
    os.remove(seg)


def stage_prep():
    for sid, src, t_in, dur, opt in SHOTS:
        print(f"prep {sid}")
        prep_shot(sid, src, t_in, dur, opt)


# --------------------------------------------------------------------------- io helpers

def read_frames(path):
    cap = cv2.VideoCapture(path)
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        out.append(f)
    return out


class Writer:
    def __init__(self, path, crf=12):
        self.p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
                                   "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                                   "-c:v", "libx264", "-preset", "medium", "-crf", str(crf),
                                   "-pix_fmt", "yuv420p", path], stdin=subprocess.PIPE)

    def write(self, frame):
        self.p.stdin.write(np.ascontiguousarray(frame, dtype=np.uint8).tobytes())

    def close(self):
        self.p.stdin.close()
        self.p.wait()


def blit(dst, rgba, x, y, alpha=1.0):
    """Alpha-composite an RGBA (BGRA) sprite onto dst (BGR) at integer x,y."""
    h, w = rgba.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return
    sp = rgba[y0 - y:y1 - y, x0 - x:x1 - x]
    a = (sp[:, :, 3:4].astype(np.float32) / 255.0) * alpha
    dst[y0:y1, x0:x1] = (dst[y0:y1, x0:x1] * (1 - a) + sp[:, :, :3] * a).astype(np.uint8)


# --------------------------------------------------------------------------- tracking

def track(frames, exclude):
    """Per-frame cumulative similarity transform (3x3) mapping frame-0 coords
    to frame-i coords, from LK flow on background features. `exclude` is a
    uint8 mask of the region NOT to track (the wearer)."""
    g0 = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)
    mask = cv2.bitwise_not(exclude)
    pts = cv2.goodFeaturesToTrack(g0, 500, 0.01, 12, mask=mask, blockSize=7)
    A = np.eye(3)
    out = [A.copy()]
    prev = g0
    for f in frames[1:]:
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, pts, None, winSize=(31, 31), maxLevel=4,
                                              criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))
        ok = st.reshape(-1) == 1
        p0, p1 = pts[ok], nxt[ok]
        M = None
        if len(p0) >= 8:
            M, inl = cv2.estimateAffinePartial2D(p0, p1, method=cv2.RANSAC, ransacReprojThreshold=2.0)
        if M is None:
            M = np.array([[1, 0, 0], [0, 1, 0]], np.float64)
        M3 = np.vstack([M, [0, 0, 1]])
        A = M3 @ A
        out.append(A.copy())
        pts = p1.reshape(-1, 1, 2)
        if len(pts) < 120:
            fresh = cv2.goodFeaturesToTrack(g, 500, 0.01, 12, mask=mask, blockSize=7)
            if fresh is not None:
                pts = np.vstack([pts, fresh]).astype(np.float32)
        prev = g
    return out


def apply_pt(A, x, y):
    v = A @ np.array([x, y, 1.0])
    return float(v[0]), float(v[1])


# --------------------------------------------------------------------------- sprites

def color_transfer(sprite_bgra, target_bgr_region, strength=0.85):
    """Match the sprite's LAB mean/std to a region of the target shot."""
    a = sprite_bgra[:, :, 3] > 40
    if a.sum() < 100:
        return sprite_bgra
    src = cv2.cvtColor(sprite_bgra[:, :, :3], cv2.COLOR_BGR2LAB).astype(np.float32)
    tgt = cv2.cvtColor(target_bgr_region, cv2.COLOR_BGR2LAB).astype(np.float32).reshape(-1, 3)
    out = src.copy()
    for c in range(3):
        sm, ss = src[:, :, c][a].mean(), src[:, :, c][a].std() + 1e-3
        tm, ts = tgt[:, c].mean(), tgt[:, c].std() + 1e-3
        ratio = float(np.clip(ts / ss, 0.75, 1.35))
        mapped = (src[:, :, c] - sm) * ratio + tm
        out[:, :, c] = src[:, :, c] * (1 - strength) + mapped * strength
    out = np.clip(out, 0, 255).astype(np.uint8)
    res = sprite_bgra.copy()
    res[:, :, :3] = cv2.cvtColor(out, cv2.COLOR_LAB2BGR)
    return res


def crop_alpha(bgra):
    ys, xs = np.where(bgra[:, :, 3] > 8)
    return bgra[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def scan_reveal(sprite_bgra, u):
    """Materialise from the ground up: rows below the scan line are visible,
    a soft 60px band with a light edge at the line. u in 0..1."""
    h = sprite_bgra.shape[0]
    line = h * (1 - u)
    ys = np.arange(h).reshape(-1, 1).astype(np.float32)
    vis = np.clip((ys - line) / 60.0 + 0.5, 0, 1)
    out = sprite_bgra.copy()
    out[:, :, 3] = (out[:, :, 3].astype(np.float32) * vis).astype(np.uint8)
    edge = np.clip(1 - np.abs(ys - line) / 18.0, 0, 1) * (u < 1.0)
    glow = (edge * 140).astype(np.uint8)
    for c in range(3):
        out[:, :, c] = np.clip(out[:, :, c].astype(np.int32) + glow * (sprite_bgra[:, :, 3] > 40), 0, 255).astype(np.uint8)
    return out


def contact_shadow(frame, cx, feet_y, width, alpha=0.24):
    sh = np.zeros((H, W), np.float32)
    cv2.ellipse(sh, (int(cx), int(feet_y)), (int(width * 0.46), int(width * 0.06)), 0, 0, 360, 1.0, -1)
    sh = cv2.GaussianBlur(sh, (0, 0), width * 0.08)
    frame[:] = (frame * (1 - sh[:, :, None] * alpha)).astype(np.uint8)


def warp_sprite(sprite, M):
    """Affine-warp a BGRA sprite into a frame-sized transparent canvas.
    BORDER_TRANSPARENT leaves untouched pixels as whatever was in memory,
    so the destination must be zeroed first."""
    dst = np.zeros((H, W, 4), np.uint8)
    cv2.warpAffine(sprite, M, (W, H), dst=dst, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_TRANSPARENT)
    return dst


def place_sprite(frame, sprite, A, x0, y0, s0, alpha=1.0):
    """Sprite anchored at frame-0 point (x0,y0) = its bottom-centre, scale s0,
    carried by the tracking transform A."""
    h, w = sprite.shape[:2]
    # sprite local -> frame0: scale s0, bottom-centre at (x0,y0)
    T = np.array([[s0, 0, x0 - s0 * w / 2], [0, s0, y0 - s0 * h], [0, 0, 1]])
    M = (A @ T)[:2]
    warped = warp_sprite(sprite, M)
    blit(frame, warped, 0, 0, alpha)


# --------------------------------------------------------------------------- fx: markers

def draw_marker(frame, ax, ay, label, sub, u, side=1):
    """Glasses-UI anchor: dot at (ax,ay), thin leader up to a compact label.
    u = animation progress 0..1."""
    if u <= 0:
        return
    ov = frame.copy()
    r = int(6 + 8 * (1 - ease_out(min(1, u * 2))))
    cv2.circle(ov, (int(ax), int(ay)), 7, ACCENT_BGR, -1, cv2.LINE_AA)
    cv2.circle(ov, (int(ax), int(ay)), r + 6, ACCENT_BGR, 2, cv2.LINE_AA)
    ln = ease_out(min(1, max(0, (u - 0.15) / 0.5)))
    lx, ly = int(ax + side * 90 * ln), int(ay - 120 * ln)
    cv2.line(ov, (int(ax), int(ay)), (lx, ly), (250, 250, 250), 2, cv2.LINE_AA)
    cv2.addWeighted(ov, 0.92, frame, 0.08, 0, frame)
    tu = ease_out(min(1, max(0, (u - 0.5) / 0.5)))
    if tu > 0:
        lab = text_sprite(label, 34, "SemiBold", (250, 250, 250), tracking=2)
        sub_s = text_sprite(sub, 26, "Medium", ACCENT, tracking=3)
        tx = lx + (12 if side > 0 else -12 - lab.shape[1])
        ty = ly - lab.shape[0] - 26
        pad = 14
        boxw = max(lab.shape[1], sub_s.shape[1]) + 2 * pad
        boxh = lab.shape[0] + sub_s.shape[0] + 2 * pad + 4
        bx = tx - pad if side > 0 else lx - 12 - boxw + pad
        bx = int(bx); by = int(ty - pad)
        box = np.zeros((boxh, boxw, 4), np.uint8)
        box[:, :, :3] = 8; box[:, :, 3] = 150
        box[-3:, :, :3] = ACCENT_BGR; box[-3:, :, 3] = 230
        blit(frame, box, bx, by + int(8 * (1 - tu)), tu)
        blit(frame, lab, bx + pad, by + pad + int(8 * (1 - tu)), tu)
        blit(frame, sub_s, bx + pad, by + pad + lab.shape[0] + 4 + int(8 * (1 - tu)), tu)


def fx_markers(frames, t0):
    ex = np.zeros((H, W), np.uint8)
    ex[:, :1000] = 255                      # the wearer fills the left
    A = track(frames, ex)
    out = []
    for i, f in enumerate(frames):
        t = i / FPS
        g = f.copy()
        x1, y1 = apply_pt(A[i], 1150, 470)   # the mill tower
        x2, y2 = apply_pt(A[i], 1395, 520)   # the falls
        draw_marker(g, x1, y1, "QUEEN BEE MILL", "BUILT 1881", (t - 0.45) / 0.9, side=-1)
        draw_marker(g, x2, y2, "BIG SIOUX FALLS", "7,400 GAL / SEC", (t - 1.25) / 0.9, side=1)
        out.append(g)
    return out


# --------------------------------------------------------------------------- fx: ice age

def build_ice_plate():
    strip = cv2.imread("../ai/iceage/iceage_hook_norail_r214_chatgpt.jpg")
    sw = 2120
    sh = int(strip.shape[0] * sw / strip.shape[1])
    strip = cv2.resize(strip, (sw, sh), interpolation=cv2.INTER_LANCZOS4)
    plate = np.zeros((H, W, 3), np.uint8)
    bottom = 800
    top = bottom - sh
    x0 = (sw - W) // 2
    plate[max(0, top):bottom, :] = strip[max(0, -top):sh, x0:x0 + W]
    sky = strip[0:6, x0:x0 + W].reshape(-1, 3).mean(axis=0)          # one colour, no banding
    deep = np.clip(sky * np.array([1.04, 0.90, 0.78]), 0, 255)       # darker, bluer toward the top
    for y in range(0, max(0, top)):
        u = (y / max(1, top)) ** 1.3
        plate[y, :] = (deep * (1 - u) + sky * u).astype(np.uint8)
    plate[bottom:, :] = strip[sh - 1, x0:x0 + W]
    t0 = max(0, top)
    plate[t0 - 60:t0 + 60] = cv2.GaussianBlur(plate[t0 - 60:t0 + 60], (0, 0), 10)
    return plate


def keep_real_mask(median):
    """Static: deck, rails, sign boards. Everything else above the deck is 'world'."""
    keep = np.zeros((H, W), np.uint8)
    deck = np.array([[0, 790], [300, 745], [600, 722], [1000, 700], [1920, 690], [1920, 1080], [0, 1080]], np.int32)
    cv2.fillPoly(keep, [deck], 255)
    hsv = cv2.cvtColor(median, cv2.COLOR_BGR2HSV)
    dark = ((hsv[:, :, 2] < 118) & (hsv[:, :, 0] > 40) & (hsv[:, :, 0] < 130)).astype(np.uint8) * 255
    band = np.zeros((H, W), np.uint8)
    cv2.fillPoly(band, [np.array([[0, 440], [1920, 440], [1920, 700], [1000, 710], [600, 730], [300, 755], [0, 800]], np.int32)], 255)
    rails = cv2.bitwise_and(dark, band)
    rails = cv2.morphologyEx(rails, cv2.MORPH_OPEN, np.ones((2, 9), np.uint8))
    rails = cv2.dilate(rails, np.ones((3, 3), np.uint8))
    keep = cv2.bitwise_or(keep, rails)
    for (x0, y0, x1, y1) in [(995, 455, 1182, 538), (1220, 455, 1422, 545)]:
        keep[y0:y1, x0:x1] = 255
    for (x0, x1) in [(1008, 1032), (1156, 1180), (1236, 1262), (1398, 1422)]:
        keep[455:700, x0:x1] = 255
    return keep


def cold_grade(img, amount, frost):
    """Push a float BGR image toward winter light by `amount` (HxW, 0..1):
    desaturate, cool the balance, lift and flatten; optional frost brightening."""
    img = img.astype(np.float32)
    gray = img.mean(axis=2, keepdims=True)
    cooled = img * 0.42 + gray * 0.58
    cooled = cooled * np.array([1.10, 1.02, 0.94], np.float32)       # BGR: more blue, less red
    cooled = cooled * 0.94 + 18
    if frost is not None:
        cooled = cooled + frost[:, :, None] * 22
    a = amount[:, :, None]
    return img * (1 - a) + cooled * a


def person_matte(frame, median):
    """Returns (matte, shadow_ratio). The matte is the wearer only -- his
    cast shadow is separated out (same hue as the deck, just darker) and
    returned as a per-pixel darkening ratio so it can be re-applied on top
    of whatever the deck has become."""
    lf = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB).astype(np.float32)
    lm = cv2.cvtColor(median, cv2.COLOR_BGR2LAB).astype(np.float32)
    ratio = np.clip((lf[:, :, 0] + 2) / (lm[:, :, 0] + 2), 0.35, 1.0)
    chroma = np.abs(lf[:, :, 1] - lm[:, :, 1]) + np.abs(lf[:, :, 2] - lm[:, :, 2])
    shadow = (ratio < 0.9) & (chroma < 9)
    d = cv2.absdiff(frame, median).max(axis=2)
    m = ((d > 24) & ~shadow).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 2500:
            keep[lab == i] = 255
    keep = cv2.erode(keep, np.ones((3, 3), np.uint8))
    keep = cv2.GaussianBlur(keep, (5, 5), 0)
    sr = np.where(ratio > 0.92, 1.0, ratio).astype(np.float32)
    sr = cv2.GaussianBlur(sr, (0, 0), 2)
    return keep, sr


def fx_iceage(frames, t0):
    # Clean background: he stands far right for the first 4s and centre-right
    # from 20s on, so each half of the plate comes from the window where he
    # is NOT in it (a plain median keeps him -- he barely moves).
    cap = cv2.VideoCapture("../raw/IMG_6790.MOV")

    def med(ts):
        fr = []
        for t in ts:
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            ok, f = cap.read()
            if ok:
                fr.append(f)
        return np.median(np.stack(fr), axis=0).astype(np.uint8)
    A_ = med(np.arange(0.2, 4.6, 0.4))
    B_ = med(np.arange(20.0, 31.0, 0.5))
    median = A_.copy()
    xs_ = 1580
    median[:, xs_:] = B_[:, xs_:]
    wgt = np.linspace(0, 1, 40).reshape(1, -1, 1)
    median[:, xs_ - 20:xs_ + 20] = (A_[:, xs_ - 20:xs_ + 20] * (1 - wgt) + B_[:, xs_ - 20:xs_ + 20] * wgt).astype(np.uint8)
    plate = build_ice_plate()
    keep = keep_real_mask(median)
    # The mammoth the operator liked, standing on the snow just beyond the
    # rail: legs behind the real rails, head and tusks above them. A
    # second, smaller one further back. Both dissolve in once the wipe has
    # passed their position.
    herd = []
    for (mx, my, msc, delay) in [(560, 690, 0.92, 0.0), (900, 648, 0.58, 0.25)]:
        sp = crop_alpha(cv2.imread(f"{WORK}/mam_rembg.png", cv2.IMREAD_UNCHANGED))
        a_ = sp[:, :, 3].astype(np.float32)
        sp[:, :, 3] = np.clip((a_ - 40) * (255.0 / 215.0), 0, 255).astype(np.uint8)
        sw_, sh_ = int(sp.shape[1] * msc), int(sp.shape[0] * msc)
        reg = plate[max(0, my - sh_):my + 20, max(0, mx - sw_ // 2):mx + sw_ // 2]
        sp = color_transfer(sp, reg, strength=0.7)
        sp = cv2.resize(sp, (sw_, sh_), interpolation=cv2.INTER_AREA)
        sp, _ = match_focus(sp, reg)
        sp = cv2.flip(sp, 1)                       # face the falls
        herd.append((sp, mx - sw_ // 2, my - sh_, delay))
    cv2.imwrite(f"{WORK}/_ice_keep.png", keep)
    cv2.imwrite(f"{WORK}/_ice_plate.png", plate)
    world = cv2.bitwise_not(keep).astype(np.float32) / 255.0
    world = cv2.GaussianBlur(world, (3, 3), 0)
    xs = np.arange(W, dtype=np.float32).reshape(1, -1)
    # a frost texture for the deck: soft noise clumps, brighter and cooler
    rng = np.random.default_rng(7)
    frost = cv2.GaussianBlur(rng.random((H // 2, W // 2)).astype(np.float32), (0, 0), 0.9)
    frost = cv2.resize(frost, (W, H), interpolation=cv2.INTER_LINEAR)
    frost = np.clip((frost - frost.mean()) / (frost.std() + 1e-6) * 0.18 + 0.55, 0, 1)
    deck_only = np.zeros((H, W), np.uint8)
    cv2.fillPoly(deck_only, [np.array([[0, 800], [300, 752], [600, 728], [1000, 706], [1920, 696], [1920, 1080], [0, 1080]], np.int32)], 255)
    frost = frost * (cv2.GaussianBlur(deck_only, (0, 0), 8) / 255.0)
    # sharpen + grain the upscaled plate so it reads as photographed, not soft
    plate = cv2.addWeighted(plate, 1.35, cv2.GaussianBlur(plate, (0, 0), 2.0), -0.35, 0)
    plate = np.clip(plate.astype(np.float32) + rng.normal(0, 3.0, plate.shape), 0, 255).astype(np.uint8)
    snow_cache = {}

    def snow_layer(i):
        if i in snow_cache:
            return snow_cache[i]
        layer = np.zeros((H, W), np.float32)
        r2 = np.random.default_rng(0)
        N = 320
        sx0 = r2.random(N) * W
        sy0 = r2.random(N) * H
        spd = 40 + r2.random(N) * 70
        drift = 10 + r2.random(N) * 25
        size = 1.2 + r2.random(N) * 2.2
        bright = 0.35 + r2.random(N) * 0.5
        tt = i / FPS
        for k in range(N):
            x = (sx0[k] + drift[k] * tt + 6 * math.sin(tt * 1.3 + k)) % W
            y = (sy0[k] + spd[k] * tt) % H
            cv2.circle(layer, (int(x), int(y)), int(size[k]), float(bright[k]), -1, cv2.LINE_AA)
        layer = cv2.GaussianBlur(layer, (0, 0), 1.2) * 120
        snow_cache[i] = layer[:, :, None]
        return snow_cache[i]
    wipe_t0, wipe_t1 = 0.35, 2.05         # local seconds
    out = []
    n = len(frames)
    for i, f in enumerate(frames):
        t = i / FPS
        p = ease((t - wipe_t0) / (wipe_t1 - wipe_t0))
        seam = -200 + p * (W + 400)
        a = np.clip((seam - xs) / 110.0 + 0.5, 0, 1)      # 1 left of the seam
        a = a * world
        plate_i = plate
        if p >= 1.0 or t > wipe_t1 - 0.3:
            plate_i = plate.copy()
            for sp, sx_, sy_, delay in herd:
                uu = ease((t - (wipe_t1 - 0.3) - delay) / 0.9)
                if uu > 0:
                    contact_shadow(plate_i, sx_ + sp.shape[1] // 2, sy_ + sp.shape[0] - 2, sp.shape[1] * 0.9, alpha=0.22 * uu)
                    blit(plate_i, sp, sx_, sy_, uu)
        comp = f.astype(np.float32) * (1 - a[:, :, None]) + plate_i.astype(np.float32) * a[:, :, None]
        # frost bloom just behind the leading edge
        if 0 < p < 1:
            bloom = np.clip(1 - np.abs(xs - seam + 40) / 90.0, 0, 1) * world * 28
            comp = np.clip(comp + bloom[:, :, None], 0, 255)
        # the real foreground (deck, rails, boards) goes COLD as the seam
        # passes -- keeping it in July light was the loudest mismatch
        cold_a = np.clip((seam - xs) / 160.0 + 0.5, 0, 1) * (1 - world)
        comp = cold_grade(comp, cold_a * 0.85, frost)
        # falling snow over the transformed side
        if p > 0:
            comp = comp + snow_layer(i) * a[:, :, None]
        comp = np.clip(comp, 0, 255).astype(np.uint8)
        # the wearer, live, in front of everything (lightly cooled too);
        # his real shadow re-applied onto the transformed deck
        pm8, sr = person_matte(f, median)
        pm = pm8.astype(np.float32)[:, :, None] / 255.0
        comp = (comp.astype(np.float32) * sr[:, :, None]).astype(np.uint8)
        fcool = np.clip(cold_grade(f.astype(np.float32), np.full((H, W), 0.35, np.float32) * (p > 0), None), 0, 255)
        comp = np.clip(comp * (1 - pm) + fcool * pm, 0, 255).astype(np.uint8)
        if 0 < p < 1:
            # soft frost edge, no line
            band = np.clip(1 - np.abs(xs - seam) / 55.0, 0, 1) ** 2 * 40
            comp = np.clip(comp.astype(np.float32) + band[:, :, None] * (1 - pm), 0, 255).astype(np.uint8)
        # slow push-in so the frame breathes
        s = 1.0 + 0.05 * (i / max(1, n - 1))
        M = cv2.getRotationMatrix2D((W * 0.62, H * 0.55), 0, s)
        comp = cv2.warpAffine(comp, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        out.append(comp)
    return out


# --------------------------------------------------------------------------- fx: elements

def sharpness(bgr):
    return cv2.Laplacian(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()


def match_focus(sprite, bg_region):
    """Blur the sprite until its Laplacian variance sits just under the
    footage it stands in. A cutout that is sharper than its background is
    the single loudest 'pasted' tell."""
    target = sharpness(bg_region) * 0.85
    a = sprite[:, :, 3] > 128
    if a.sum() < 500:
        return sprite, 0.0
    cur = cv2.Laplacian(cv2.cvtColor(sprite[:, :, :3], cv2.COLOR_BGR2GRAY), cv2.CV_64F)[a].var()
    sigma = 0.0
    while cur > target and sigma < 6.0:
        sigma += 0.25
        b = cv2.GaussianBlur(sprite[:, :, :3], (0, 0), sigma)
        cur = cv2.Laplacian(cv2.cvtColor(b, cv2.COLOR_BGR2GRAY), cv2.CV_64F)[a].var()
    if sigma > 0:
        sprite = sprite.copy()
        sprite[:, :, :3] = cv2.GaussianBlur(sprite[:, :, :3], (0, 0), sigma)
        sprite[:, :, 3] = cv2.GaussianBlur(sprite[:, :, 3], (0, 0), max(0.6, sigma * 0.5))
    return sprite, sigma


def light_wrap(comp, sprite_alpha_full, bg, width=9, amount=0.55):
    """Let the background bleed into the sprite's edge band."""
    a = sprite_alpha_full.astype(np.float32) / 255.0
    inner = cv2.erode((a > 0.5).astype(np.uint8), np.ones((width, width), np.uint8)).astype(np.float32)
    band = np.clip(a - inner, 0, 1)
    band = cv2.GaussianBlur(band, (0, 0), width / 2) * amount
    bgb = cv2.GaussianBlur(bg, (0, 0), width)
    return (comp * (1 - band[:, :, None]) + bgb * band[:, :, None]).astype(np.uint8)


def reveal_frame(sprite, u):
    """Materialise: the sprite dissolves in with a soft warm bloom that
    resolves into the object. No scan line."""
    if u >= 1:
        return sprite, None
    sp = sprite.copy()
    sp[:, :, 3] = (sp[:, :, 3].astype(np.float32) * ease(u)).astype(np.uint8)
    glow = np.zeros_like(sprite)
    k = (1 - u) * 0.7
    glow[:, :, :3] = ACCENT_BGR
    glow[:, :, 3] = (cv2.GaussianBlur(sprite[:, :, 3], (0, 0), 25 + 40 * (1 - u)) * k).astype(np.uint8)
    return sp, glow


def fx_element(frames, sprite_path, anchor, scale, exclude_rect, appear=(0.4, 1.3),
               reflection=None, breathe=True, color_strength=0.55):
    """Track the background, then stand a cutout on the real ground:
    colour-matched, defocus-matched, light-wrapped, with a contact shadow
    (and a water reflection when asked), dissolving in under a bloom."""
    x0, y0 = anchor
    ex = np.zeros((H, W), np.uint8)
    ex[exclude_rect[1]:exclude_rect[3], exclude_rect[0]:exclude_rect[2]] = 255
    A = track(frames, ex)
    sprite = crop_alpha(cv2.imread(sprite_path, cv2.IMREAD_UNCHANGED))
    a = sprite[:, :, 3].astype(np.float32)
    sprite[:, :, 3] = np.clip((a - 40) * (255.0 / 215.0), 0, 255).astype(np.uint8)
    sw, sh = int(sprite.shape[1] * scale), int(sprite.shape[0] * scale)
    ry0, ry1 = max(0, int(y0 - sh * 1.1)), min(H, int(y0 + 30))
    rx0, rx1 = max(0, int(x0 - sw * 0.7)), min(W, int(x0 + sw * 0.7))
    region = frames[0][ry0:ry1, rx0:rx1]
    sprite = color_transfer(sprite, region, strength=color_strength)
    sprite = cv2.resize(sprite, (sw, sh), interpolation=cv2.INTER_AREA)
    sprite, sigma = match_focus(sprite, region)
    print(f"    focus-matched with sigma={sigma:.2f}; bg sharp={sharpness(region):.0f}")
    out = []
    n = len(frames)
    for i, f in enumerate(frames):
        t = i / FPS
        u = ease_out((t - appear[0]) / (appear[1] - appear[0]))
        g = f.copy()
        if u <= 0:
            out.append(g)
            continue
        s = 1.0 + (0.006 * math.sin(2 * math.pi * 0.22 * t) if breathe else 0.0)
        fx_, fy_ = apply_pt(A[i], x0, y0)
        contact_shadow(g, fx_, fy_ - 3, sw * 0.9, alpha=0.26 * u)
        sp, glow = reveal_frame(sprite, u)
        if reflection:
            # mirror into the water below the feet, squashed and faded
            rf = cv2.flip(sp, 0)
            rf = cv2.resize(rf, (sw, int(sh * reflection["squash"])), interpolation=cv2.INTER_AREA)
            rf[:, :, 3] = (rf[:, :, 3].astype(np.float32) * reflection["alpha"]
                           * np.linspace(1, 0, rf.shape[0]).reshape(-1, 1)).astype(np.uint8)
            rf[:, :, :3] = cv2.GaussianBlur(rf[:, :, :3], (0, 0), 3)
            Tm = np.array([[s, 0, x0 - s * sw / 2], [0, s, y0 + 2], [0, 0, 1]])
            Mr = (A[i] @ Tm)[:2]
            wr = warp_sprite(rf, Mr)
            wm = np.zeros((H, W), np.uint8)
            cv2.fillPoly(wm, [np.array(reflection["water_poly"], np.int32)], 255)
            wr[:, :, 3] = (wr[:, :, 3].astype(np.float32) * (cv2.GaussianBlur(wm, (0, 0), 12) / 255.0)).astype(np.uint8)
            blit(g, wr, 0, 0, 1.0)
        Ts = np.array([[s, 0, x0 - s * sw / 2], [0, s, y0 - s * sh], [0, 0, 1]])
        M = (A[i] @ Ts)[:2]
        warped = warp_sprite(sp, M)
        if glow is not None:
            wg = warp_sprite(glow, M)
            ga = wg[:, :, 3:4].astype(np.float32) / 255.0
            g[:] = np.clip(g.astype(np.float32) + np.array(ACCENT_BGR, np.float32) * ga * 0.6, 0, 255).astype(np.uint8)
        bg = g.copy()
        blit(g, warped, 0, 0, 1.0)
        g = light_wrap(g, warped[:, :, 3], bg)
        out.append(g)
    return out


def stage_fx():
    for sid, src, t_in, dur, opt in SHOTS:
        fx = opt.get("fx")
        if not fx:
            continue
        out = f"{SHOTS_DIR}/{sid}_fx.mp4"
        if os.path.exists(out):
            print(f"fx {sid}: cached")
            continue
        print(f"fx {sid}")
        frames = read_frames(f"{SHOTS_DIR}/{sid}.mp4")
        t0 = shot_start(sid)
        if fx == "markers":
            res = fx_markers(frames, t0)
        elif fx == "iceage":
            res = fx_iceage(frames, t0)
        elif fx == "mammoth":
            res = fx_element(frames, f"{WORK}/mam_rembg.png", anchor=(560, 985), scale=0.92,
                             exclude_rect=(1180, 0, 1920, 1080), appear=(0.35, 1.35),
                             reflection=dict(squash=0.45, alpha=0.28,
                                             water_poly=[(0, 950), (900, 900), (1200, 960), (1200, 1080), (0, 1080)]))
        elif fx == "dakota":
            res = fx_element(frames, f"{WORK}/dak_rembg.png", anchor=(1300, 738), scale=0.9,
                             exclude_rect=(0, 0, 780, 1080), appear=(0.3, 1.2), breathe=False)
        else:
            raise KeyError(fx)
        w = Writer(out)
        for fr in res:
            w.write(fr)
        w.close()


# --------------------------------------------------------------------------- picture

# Clean and neutral: the phone footage's own colour, a touch of contrast,
# no cast. The teal/orange balance and heavy vignette+grain of the first
# two cuts read as "off" -- because they were.
GRADE = "eq=contrast=1.03:saturation=1.01,unsharp=5:5:0.2"


def stage_picture():
    lst = f"{WORK}/_concat.txt"
    with open(lst, "w") as fh:
        for sid, src, t_in, dur, opt in SHOTS:
            p = f"{SHOTS_DIR}/{sid}_fx.mp4" if opt.get("fx") else f"{SHOTS_DIR}/{sid}.mp4"
            fh.write(f"file '{os.path.abspath(p)}'\n")
    graded = f"{WORK}/picture_graded.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
         "-vf", GRADE + f",fps={FPS}", "-frames:v", int(round(TOTAL * FPS)), *ENC, graded])
    # type + UI pass
    frames_n = int(round(TOTAL * FPS))
    cap = cv2.VideoCapture(graded)
    w = Writer(f"{WORK}/picture.mp4")
    cards = [(a, b, card_sprite(lines)) for a, b, lines in CARDS]
    tags = [(a, b, tag_sprite(txt)) for a, b, txt in TAGS]
    end = end_card_sprites()
    prod_t = shot_start("turn30")
    for i in range(frames_n):
        ok, f = cap.read()
        if not ok:
            break
        t = i / FPS
        for a, b, sp in cards:
            if a <= t < b:
                u_in = ease_out((t - a) / 0.38)
                u_out = ease((b - t) / 0.3)
                al = min(u_in, u_out)
                scrim_lower_left(f, al * 0.38)
                blit(f, sp, 120, H - 150 - sp.shape[0] + int(16 * (1 - u_in)), al)
        for a, b, sp in tags:
            if a <= t < b:
                al = min(ease_out((t - a) / 0.3), ease((b - t) / 0.25))
                blit(f, sp, W - 96 - sp.shape[1], 72, al)
        # white flash into the product beat
        if prod_t - 0.06 <= t < prod_t + 0.22:
            k = 1 - abs((t - prod_t) / 0.16)
            k = max(0, min(1, k)) * 0.85
            f[:] = np.clip(f.astype(np.float32) * (1 - k) + 255 * k, 0, 255).astype(np.uint8)
        if t >= END_CARD_START - 0.5:
            u = ease((t - (END_CARD_START - 0.5)) / 0.9)
            f[:] = (f.astype(np.float32) * (1 - 0.62 * u)).astype(np.uint8)
            brand, tag, rule = end
            ub = ease_out((t - END_CARD_START) / 0.6)
            ut = ease_out((t - END_CARD_START - 0.25) / 0.6)
            if ub > 0:
                blit(f, brand, (W - brand.shape[1]) // 2, H // 2 - 70 - brand.shape[0] // 2 + int(14 * (1 - ub)), ub)
                blit(f, rule, (W - rule.shape[1]) // 2, H // 2 + 8, ub)
            if ut > 0:
                blit(f, tag, (W - tag.shape[1]) // 2, H // 2 + 36 + int(10 * (1 - ut)), ut)
        w.write(f)
    w.close()


def font(weight, size):
    return ImageFont.truetype(f"{FONTS}/{'InterDisplay-Bold' if weight == 'Display' else 'Inter-' + weight}.ttf", size)


def text_sprite(text, size, weight, color, tracking=0):
    fnt = font(weight, size)
    tmp = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    widths = [tmp.textlength(ch, font=fnt) for ch in text]
    tw = int(sum(widths) + tracking * (len(text) - 1)) + 8
    asc, desc = fnt.getmetrics()
    im = Image.new("RGBA", (tw, asc + desc + 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = 2
    for ch, wch in zip(text, widths):
        d.text((x, 2), ch, font=fnt, fill=color + (255,))
        x += wch + tracking
    arr = np.array(im)
    return cv2.cvtColor(arr, cv2.COLOR_RGBA2BGRA)


def card_sprite(lines):
    parts = [text_sprite(ln, 84, "Display", INK, tracking=-2) for ln in lines]
    hh = sum(p.shape[0] for p in parts) - 14 * (len(parts) - 1)
    ww = max(p.shape[1] for p in parts)
    out = np.zeros((hh + 30, ww + 30, 4), np.uint8)
    y = 0
    for p in parts:
        # soft drop shadow for legibility over bright footage
        sh = np.zeros_like(p); sh[:, :, 3] = p[:, :, 3]
        sh = cv2.GaussianBlur(sh, (0, 0), 6)
        blit_rgba(out, sh, 6, y + 8, 0.6)
        blit_rgba(out, p, 0, y, 1.0)
        y += p.shape[0] - 14
    return out


def tag_sprite(text):
    t = text_sprite(text, 22, "SemiBold", (240, 238, 232), tracking=3)
    pad = 12
    out = np.zeros((t.shape[0] + 2 * pad - 6, t.shape[1] + 2 * pad, 4), np.uint8)
    out[:, :, :3] = 10; out[:, :, 3] = 140
    out[:, :3, :3] = ACCENT_BGR; out[:, :3, 3] = 235
    blit_rgba(out, t, pad + 4, pad - 3, 1.0)
    return out


def end_card_sprites():
    brand = text_sprite(BRAND, 78, "Display", INK, tracking=6)
    tag = text_sprite(TAGLINE, 40, "Medium", (225, 222, 215), tracking=1)
    rule = np.zeros((3, 220, 4), np.uint8)
    rule[:, :, :3] = ACCENT_BGR; rule[:, :, 3] = 255
    return brand, tag, rule


def blit_rgba(dst, sp, x, y, alpha):
    h, w = sp.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if x1 <= x0 or y1 <= y0:
        return
    s = sp[y0 - y:y1 - y, x0 - x:x1 - x].astype(np.float32)
    d = dst[y0:y1, x0:x1].astype(np.float32)
    sa = s[:, :, 3:4] / 255.0 * alpha
    da = d[:, :, 3:4] / 255.0
    oa = sa + da * (1 - sa)
    col = (s[:, :, :3] * sa + d[:, :, :3] * da * (1 - sa)) / np.maximum(oa, 1e-4)
    dst[y0:y1, x0:x1, :3] = col.astype(np.uint8)
    dst[y0:y1, x0:x1, 3] = (oa[:, :, 0] * 255).astype(np.uint8)


_SCRIM = None


def scrim_lower_left(frame, strength):
    global _SCRIM
    if _SCRIM is None:
        yy = np.linspace(0, 1, H).reshape(-1, 1)
        xx = np.linspace(0, 1, W).reshape(1, -1)
        g = np.clip((yy - 0.62) / 0.38, 0, 1) ** 1.3 * np.clip(1.05 - xx * 1.25, 0, 1) ** 0.9
        _SCRIM = g.astype(np.float32)[:, :, None]
    frame[:] = (frame * (1 - _SCRIM * strength)).astype(np.uint8)


# --------------------------------------------------------------------------- audio

SR = 48000


def load_audio(path, offset=0.0, dur=None):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(offset), "-i", path]
    if dur:
        cmd += ["-t", str(dur)]
    cmd += ["-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def db(x):
    return 10 ** (x / 20)


def env_points(points, n):
    """Piecewise-linear gain envelope in dB from (t, dB) points."""
    ts = np.array([p[0] for p in points]); vs = np.array([p[1] for p in points])
    t = np.arange(n) / SR
    return db(np.interp(t, ts, vs)).astype(np.float32)[:, None]


def fade_edges(a, fi, fo):
    n = len(a); k1, k2 = int(fi * SR), int(fo * SR)
    if k1:
        a[:k1] *= np.linspace(0, 1, k1)[:, None]
    if k2:
        a[-k2:] *= np.linspace(1, 0, k2)[:, None]
    return a


def stage_audio():
    n = int(TOTAL * SR)
    bus = np.zeros((n, 2), np.float32)
    # music: sneaks in under the cold open, lifts into the markers, hits at the wipe
    m = load_audio(MUSIC, MUSIC_OFFSET, TOTAL + 1)[:n]
    m *= env_points([(0, -15), (4.4, -13), (9.5, -7), (11.3, -6), (12.55, -6), (12.6, 0), (25.9, 0),
                     (26.0, -3), (33.4, -3), (33.5, 0), (37.0, 0), (38.1, -3), (40.0, -40)], n)
    bus += m * 0.9
    # natural sound per shot, light, crossfaded at the cuts
    t = 0.0
    for sid, src, t_in, dur, opt in SHOTS:
        a = load_audio(f"{SHOTS_DIR}/{sid}.wav", 0, dur)
        k = int(dur * SR)
        a = a[:k]
        if len(a) < k:
            a = np.vstack([a, np.zeros((k - len(a), 2), np.float32)])
        lvl = {"open": -14, "falls": -8, "plaque": -22, "reading": -16, "markers": -14, "iceage": -20,
               "mammoth": -12, "dakota": -12, "point": -16, "walk": -16, "visitors": -14, "close": -16}.get(sid, -16)
        if opt.get("still"):
            lvl = -60
        a = fade_edges(a * db(lvl), 0.08, 0.12)
        i0 = int(t * SR)
        bus[i0:i0 + k] += a
        t += dur
    # sfx
    def sfx(name, at, gain_db, trim=None):
        s = load_audio(f"{SFX}/{name}.wav")
        if trim:
            s = s[:int(trim * SR)]
            s = fade_edges(s, 0.005, min(0.25, trim / 2))
        s = s * db(gain_db)
        i0 = int(at * SR)
        k = min(len(s), n - i0)
        bus[i0:i0 + k] += s[:k]
    riser_len = ffprobe_dur(f"{SFX}/riser.wav")
    sfx("riser", 12.6 - riser_len, -12)
    sfx("boom", 12.6, -6)
    sfx("whoosh", 12.55, -14)
    sfx("pop", shot_start("markers") + 0.5, -18)
    sfx("pop", shot_start("markers") + 1.3, -18)
    sfx("whoosh", shot_start("mammoth") + 0.3, -18, trim=0.8)
    sfx("whoosh", shot_start("dakota") + 0.25, -18, trim=0.8)
    sfx("whoosh", shot_start("turn30") - 0.08, -16, trim=0.6)
    for sid_ in ("turn120", "turn210", "turn300"):
        sfx("pop", shot_start(sid_), -22)
    sfx("whoosh", shot_start("hero") - 0.05, -20, trim=0.5)
    sfx("boom", END_CARD_START, -12)
    write_wav(f"{WORK}/mix.wav", bus)
    # narration variant
    vo = np.zeros((n, 2), np.float32)
    from piper import PiperVoice
    v = PiperVoice.load("../vo/voices/en_US-lessac-high.onnx")
    for at, text in VO:
        p = f"{WORK}/_vo_{int(at*10)}.wav"
        with wave.open(p, "wb") as wv:
            v.synthesize_wav(text, wv)
        a = load_audio(p)
        a = fade_edges(a, 0.02, 0.05) * db(-1)
        i0 = int(at * SR)
        k = min(len(a), n - i0)
        vo[i0:i0 + k] += a[:k]
    # duck the bed under the voice
    duck = np.ones((n, 1), np.float32)
    env = np.abs(vo[:, 0])
    kern = int(0.08 * SR)
    env = np.convolve(env, np.ones(kern) / kern, mode="same")
    duck = 1 - 0.55 * np.clip(env / 0.02, 0, 1)[:, None]
    duck = np.convolve(duck[:, 0], np.ones(int(0.15 * SR)) / int(0.15 * SR), mode="same")[:, None]
    write_wav(f"{WORK}/mix_vo.wav", bus * duck + vo)


def write_wav(path, a):
    peak = float(np.abs(a).max())
    if peak > 0.98:
        a = a * (0.98 / peak)
    pcm = (np.clip(a, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "w") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# --------------------------------------------------------------------------- final

FINISH = "vignette=angle=PI/9:mode=forward"


def stage_final():
    os.makedirs("../out", exist_ok=True)
    for mix, name in [("mix.wav", "ORI_promo.mp4"), ("mix_vo.wav", "ORI_promo_vo.mp4")]:
        run(["ffmpeg", "-v", "error", "-y", "-i", f"{WORK}/picture.mp4", "-i", f"{WORK}/{mix}",
             "-vf", FINISH, "-af", "loudnorm=I=-14:TP=-1.5:LRA=9",
             "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
             "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", f"../out/{name}"])
        print("  ->", f"../out/{name}", ffprobe_dur(f"../out/{name}"))
        web = name.replace(".mp4", "_web.mp4")
        run(["ffmpeg", "-v", "error", "-y", "-i", f"../out/{name}", "-c:v", "libx264", "-preset", "slow", "-crf", "22",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", f"../out/{web}"])


if __name__ == "__main__":
    stages = sys.argv[1:] or ["all"]
    if stages == ["all"]:
        stages = ["prep", "fx", "picture", "audio", "final"]
    for s in stages:
        print(f"== {s}")
        globals()[f"stage_{s}"]()
