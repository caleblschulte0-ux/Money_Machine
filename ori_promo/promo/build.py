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
from spec import (W, H, FPS, BAR, TOTAL, END_CARD_START, SHOTS, CARDS, TAGS, VO, VOICE, VOICE_SPEED, EYEBROWS, AUDIO, AMBIENCE_LEVELS,
                  MUSIC, MUSIC_OFFSET, SFX, AMBIENCE, BRAND, BRAND_SUB, TAGLINE, shot_start)

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
WORK = "work"
SHOTS_DIR = f"{WORK}/shots"
FONTS = "/home/user/Shorts-pipeline/assets/fonts"
os.makedirs(SHOTS_DIR, exist_ok=True)

ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p"]
TONEMAP = ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,"
           "tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
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
    if opt.get("black"):
        run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r={FPS}", "-t", dur,
             "-frames:v", n_frames, *ENC, out])
        run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", dur, wav])
        return
    if opt.get("gen"):
        # a generated beat (falls_map.py): silent, already 1920x1080 @ FPS
        import falls_map
        falls_map.render(out, dur=dur)
        run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", dur, wav])
        return
    if opt.get("still"):
        zp = lambda n: (f"scale=2400:-1,zoompan=z='1.0+0.07*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                        f":d=1:s={W}x{H}:fps={FPS},format=yuv420p")
        if opt.get("xfade"):
            src2, t_at, xd = opt["xfade"]
            n1 = int(round((t_at + xd) * FPS))
            n2 = int(round((dur - t_at) * FPS))
            run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", src, "-loop", "1", "-i", src2,
                 "-filter_complex",
                 f"[0:v]{zp(n1)},trim=duration={t_at + xd:.3f}[a];[1:v]{zp(n2)},trim=duration={dur - t_at:.3f}[b];"
                 f"[a][b]xfade=transition=fade:duration={xd}:offset={t_at}",
                 "-frames:v", n_frames, *ENC, out])
        else:
            run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", src, "-t", dur,
                 "-vf", zp(n_frames), "-frames:v", n_frames, *ENC, out])
        run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", dur, wav])
        return
    speed = opt.get("speed", 1.0)
    src_dur = dur * speed
    pad = 0.6 if opt.get("stab") else 0.0
    ss = max(0.0, t_in - pad)
    lead = t_in - ss
    seg = f"{WORK}/_seg_{sid}.mp4"
    # The phone shoots 10-bit HLG BT.2020 (Dolby Vision profile 8). Decoding
    # that as SDR is what made every cut look grey and flat; tone-map here,
    # once, and never "correct" it afterwards.
    pre = "" if opt.get("sdr") else f"{TONEMAP},"
    run(["ffmpeg", "-v", "error", "-y", "-ss", ss, "-i", src, "-t", src_dur + 2 * pad,
         "-vf", f"{pre}scale={W}:{H}:flags=lanczos", "-an", *ENC, seg])
    vf = []
    if opt.get("stab"):
        trf = f"{WORK}/_{sid}.trf"
        tri = ":tripod=1" if opt.get("tripod") else ""
        run(["ffmpeg", "-v", "error", "-y", "-i", seg,
             "-vf", f"vidstabdetect=shakiness=8:accuracy=15:stepsize=4{tri}:result={trf}", "-f", "null", "-"])
        mode = "tripod=1" if opt.get("tripod") else f"smoothing={opt.get('smooth', 24)}"
        vf.append(f"vidstabtransform=input={trf}:{mode}:zoom={opt.get('zoom', 3)}:optzoom=0:crop=black:interpol=bicubic")
    vf.append(f"trim=start={lead:.4f}:duration={src_dur:.4f},setpts=PTS-STARTPTS")
    # 30 -> 24 by dropping frames judders anything that MOVES: a pan steps
    # double every fifth frame, and it measured as three times the shake of
    # the source. Camera moves and slow-mo are motion-compensated instead;
    # a locked-off shot just drops frames (nothing in it moves enough to see).
    if speed != 1.0 or opt.get("mc") or opt.get("stab"):
        vf.append(f"minterpolate=fps={FPS/speed:.4f}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,setpts=PTS/{speed}")
    else:
        vf.append(f"fps={FPS}")
    if opt.get("crop"):
        cx, cy, sc = opt["crop"]
        cw, ch = int(W / sc), int(H / sc)
        x0 = int(min(max(0, cx - cw / 2), W - cw)); y0 = int(min(max(0, cy - ch / 2), H - ch))
        vf.append(f"crop={cw}:{ch}:{x0}:{y0}")
    vf.append(f"fps={FPS},scale={W}:{H}:flags=lanczos,tpad=stop_mode=clone:stop_duration=1")
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


def draw_reticle(frame, cx, cy, u, done):
    """Corner brackets closing in on the view, then a 'site recognized'
    tag -- the glasses visibly locking on before the labels pop."""
    if u <= 0:
        return
    k = ease_out(u)
    half = int(420 - 160 * k)
    L = 34
    ov = frame.copy()
    col = ACCENT_BGR if done else (250, 250, 250)
    for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        x, y = int(cx + sx * half), int(cy + sy * half * 0.62)
        cv2.line(ov, (x, y), (x - sx * L, y), col, 2, cv2.LINE_AA)
        cv2.line(ov, (x, y), (x, y - sy * L), col, 2, cv2.LINE_AA)
    cv2.addWeighted(ov, 0.9, frame, 0.1, 0, frame)
    if done:
        tag = text_sprite("SITE RECOGNIZED", 24, "SemiBold", ACCENT, tracking=4)
        blit(frame, tag, int(cx - tag.shape[1] / 2), int(cy + half * 0.62 + 18), 1.0)


def fx_activate(frames, t0):
    """Tight on his glasses: a small bracket locks onto the lens, a glint
    crosses it, an amber dot and 'ACTIVE' hold -- the glasses switching on."""
    cx, cy = 920, 320
    out = []
    for i, f in enumerate(frames):
        t = i / FPS
        g = f.copy()
        u = ease_out((t - 0.4) / 0.5)
        if u > 0:
            half = int(150 - 70 * u)
            L = 22
            ov = g.copy()
            col = ACCENT_BGR if u >= 1 else (250, 250, 250)
            for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                x, y = int(cx + sx * half * 1.35), int(cy + sy * half * 0.7)
                cv2.line(ov, (x, y), (x - sx * L, y), col, 2, cv2.LINE_AA)
                cv2.line(ov, (x, y), (x, y - sy * L), col, 2, cv2.LINE_AA)
            cv2.addWeighted(ov, 0.9, g, 0.1, 0, g)
        if 0.9 <= t < 1.5:
            # glint across the lens
            k = (t - 0.9) / 0.6
            xs = np.arange(W, dtype=np.float32).reshape(1, -1); ys = np.arange(H, dtype=np.float32).reshape(-1, 1)
            pos = (cx - 260) + 520 * k
            band = np.exp(-(((xs + 0.6 * (ys - cy)) - pos) / 40.0) ** 2)
            win = np.exp(-(((xs - cx) / 230.0) ** 2 + ((ys - cy) / 110.0) ** 2))
            g = np.clip(g.astype(np.float32) + (band * win)[:, :, None] * 110, 0, 255).astype(np.uint8)
        if t >= 1.0:
            pu = 0.7 + 0.3 * math.sin(2 * math.pi * 1.4 * t)
            ov = g.copy()
            cv2.circle(ov, (cx, cy), 6, ACCENT_BGR, -1, cv2.LINE_AA)
            cv2.circle(ov, (cx, cy), int(10 + 6 * pu), ACCENT_BGR, 2, cv2.LINE_AA)
            cv2.addWeighted(ov, 0.9, g, 0.1, 0, g)
            tag = text_sprite("ACTIVE", 24, "SemiBold", ACCENT, tracking=5)
            blit(g, tag, int(cx - tag.shape[1] / 2), int(cy + 150 * 0.7 + 14), min(1.0, (t - 1.0) / 0.3))
        out.append(g)
    return out


def fx_markers(frames, t0):
    ex = np.zeros((H, W), np.uint8)
    ex[:, :1000] = 255                      # the wearer fills the left
    A = track(frames, ex)
    out = []
    for i, f in enumerate(frames):
        t = i / FPS
        g = f.copy()
        rx, ry = apply_pt(A[i], 1290, 500)
        if t < 0.95:
            fade = 1.0 if t < 0.7 else ease((0.95 - t) / 0.25)
            tmp = g.copy()
            draw_reticle(tmp, rx, ry, (t - 0.05) / 0.35, done=(t >= 0.42))
            cv2.addWeighted(tmp, fade, g, 1 - fade, 0, g)
        x1, y1 = apply_pt(A[i], 1150, 470)   # the mill tower
        x2, y2 = apply_pt(A[i], 1395, 520)   # the falls
        draw_marker(g, x1, y1, "QUEEN BEE MILL", "BUILT 1881", (t - 0.85) / 0.9, side=-1)
        draw_marker(g, x2, y2, "BIG SIOUX FALLS", "7,400 GAL / SEC", (t - 1.45) / 0.9, side=1)
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
    for (mx, my, msc, delay) in [(560, 700, 0.62, 0.0), (230, 708, 0.46, 0.25)]:
        sp = crop_alpha(cv2.imread(f"{WORK}/mam_rembg.png", cv2.IMREAD_UNCHANGED))
        a_ = sp[:, :, 3].astype(np.float32)
        sp[:, :, 3] = np.clip((a_ - 40) * (255.0 / 215.0), 0, 255).astype(np.uint8)
        sw_, sh_ = int(sp.shape[1] * msc), int(sp.shape[0] * msc)
        reg = plate[max(0, my - sh_):my + 20, max(0, mx - sw_ // 2):mx + sw_ // 2]
        sp = color_transfer(sp, reg, strength=0.3)   # cool it, don't bleach it
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
                    walk = int(9 * max(0.0, t - wipe_t1))           # the herd ambles toward the falls
                    contact_shadow(plate_i, sx_ + walk + sp.shape[1] // 2, sy_ + sp.shape[0] - 2, sp.shape[1] * 0.9, alpha=0.22 * uu)
                    blit(plate_i, sp, sx_ + walk, sy_, uu)
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


def person_tracks(frames):
    """Head-top and feet positions for the two walkers, from background
    difference blobs, fitted to smooth quadratics in time so the overlay
    never jitters. Returns [(t0, t1, fx_head, fy_head, fy_feet, height)]."""
    small = [cv2.resize(f, (960, 540)) for f in frames]
    med = np.median(np.stack(small[::3]), axis=0).astype(np.uint8)
    obs = []
    for i, s in enumerate(small):
        d = cv2.absdiff(s, med).max(axis=2)
        m = (d > 32).astype(np.uint8) * 255
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        n, lab, st, cen = cv2.connectedComponentsWithStats(m)
        blobs = []
        for k in range(1, n):
            a, x, y, w, h = st[k, cv2.CC_STAT_AREA], st[k, cv2.CC_STAT_LEFT], st[k, cv2.CC_STAT_TOP], st[k, cv2.CC_STAT_WIDTH], st[k, cv2.CC_STAT_HEIGHT]
            if a > 4000 and h > 150 and y < 120:
                ys, xs = np.where(lab[y:y + 30, x:x + w] == k)
                blobs.append((float(x + xs.mean()) * 2, float(y) * 2, float(y + h) * 2, float(w) * 2))
        obs.append(blobs)
    # two tracks: A = the one present from frame 0 (him), B = the one that enters from the right
    tracks = {"A": [], "B": []}

    def pred(tr, i):
        if len(tr) < 3:
            return tr[-1][1] if tr else None
        ts = np.array([o[0] for o in tr[-8:]], np.float64); xs = np.array([o[1] for o in tr[-8:]])
        return float(np.polyval(np.polyfit(ts, xs, 1), i))

    for i, blobs in enumerate(obs):
        blobs = sorted(blobs, key=lambda b_: b_[0])
        blobs = [b_ for b_ in blobs if b_[3] < 330]          # a merged pair is wider than one walker
        if not blobs:
            continue
        pa, pb = pred(tracks["A"], i), pred(tracks["B"], i)
        if pa is None:
            tracks["A"].append((i,) + blobs[0][:3]); continue
        if pb is None:
            # the second walker enters from the right edge
            cand = [b_ for b_ in blobs if abs(b_[0] - pa) > 120 and b_[0] > 1400]
            near = min(blobs, key=lambda b_: abs(b_[0] - pa))
            if abs(near[0] - pa) < 160:
                tracks["A"].append((i,) + near[:3])
            if cand:
                tracks["B"].append((i,) + cand[-1][:3])
            continue
        if len(blobs) == 1:
            x = blobs[0][0]
            key = "A" if abs(pa - x) <= abs(pb - x) else "B"
            if abs((pa if key == "A" else pb) - x) < 160:
                tracks[key].append((i,) + blobs[0][:3])
        else:
            b1, b2 = blobs[0], blobs[-1]
            straight = abs(pa - b1[0]) + abs(pb - b2[0]); crossed = abs(pa - b2[0]) + abs(pb - b1[0])
            if straight <= crossed:
                tracks["A"].append((i,) + b1[:3]); tracks["B"].append((i,) + b2[:3])
            else:
                tracks["A"].append((i,) + b2[:3]); tracks["B"].append((i,) + b1[:3])
    out = []
    n = len(frames)
    for key in ("A", "B"):
        tr = tracks[key]
        if len(tr) < 8:
            continue
        ts = np.array([o[0] for o in tr], np.float64)
        kx = np.polyfit(ts, [o[1] for o in tr], 2)
        ky = np.polyfit(ts, [o[2] for o in tr], 1)
        kf = np.polyfit(ts, [o[3] for o in tr], 1)
        hgt = float(np.median([o[3] - o[2] for o in tr]))
        t0, t1 = int(ts.min()), int(ts.max())
        out.append((max(0, t0 - 4), min(n - 1, t1 + 4), lambda i, k=kx: float(np.polyval(k, i)),
                    lambda i, k=ky: float(np.polyval(k, i)), lambda i, k=kf: float(np.polyval(k, i)), hgt))
        print(f"    track {key}: frames {t0}-{t1}, height {hgt:.0f}px, {len(tr)} obs")
    return out


def draw_waves(frame, cx, cy, t, col, phase=0.0, r0=26, spacing=34, n=3, forward=-1):
    """Sound arcs leaving the glasses, forward of the walker."""
    ov = frame.copy()
    for k in range(n):
        u = ((t * 1.1 + phase + k / n) % 1.0)
        r = int(r0 + u * spacing * n)
        al = (1 - u) * 0.9
        ang0 = 180 - 55 if forward < 0 else -55
        cv2.ellipse(ov, (int(cx), int(cy)), (r, r), 0, ang0, ang0 + 110, col, 3, cv2.LINE_AA)
        cv2.addWeighted(ov, al, frame, 1 - al, 0, frame)
        ov = frame.copy()


def draw_bubble(frame, cx, feet_y, rx, col, t, strength=1.0):
    """A soft ring on the ground around the walker -- their private audio zone."""
    ry = int(rx * 0.22)
    glow = np.zeros_like(frame)
    cv2.ellipse(glow, (int(cx), int(feet_y)), (int(rx), ry), 0, 0, 360, col, 4, cv2.LINE_AA)
    glow = cv2.GaussianBlur(glow, (0, 0), 6)
    pulse = 0.75 + 0.25 * math.sin(2 * math.pi * 0.9 * t)
    frame[:] = np.clip(frame.astype(np.int32) + glow.astype(np.int32) * (0.9 * strength * pulse), 0, 255).astype(np.uint8)
    ov = frame.copy()
    cv2.ellipse(ov, (int(cx), int(feet_y)), (int(rx), ry), 0, 0, 360, col, 2, cv2.LINE_AA)
    cv2.addWeighted(ov, 0.85 * strength, frame, 1 - 0.85 * strength, 0, frame)


COOL = (255, 235, 200)          # BGR: cool white-blue for the other group


def fx_sync(frames, t0):
    tracks = person_tracks(frames)
    if not tracks:
        return frames
    out = []
    labels = [text_sprite("YOUR GROUP", 26, "SemiBold", ACCENT, tracking=3),
              text_sprite("ANOTHER GROUP", 26, "SemiBold", (200, 235, 255), tracking=3)]
    cols = [ACCENT_BGR, COOL]
    for i, f in enumerate(frames):
        t = i / FPS
        g = f.copy()
        for k, (a, b_, fx_, fy_, ff_, hgt) in enumerate(tracks):
            if not (a <= i <= b_):
                continue
            fade = min(1.0, (i - a) / 8.0, (b_ - i) / 8.0)
            fade *= ease_out(min(1.0, (t - 0.5) / 0.6))          # overlay arrives after the shot settles
            if fade <= 0:
                continue
            hx, hy, feet = fx_(i), fy_(i), ff_(i)
            eye_y = hy + hgt * 0.12
            eye_x = hx - hgt * 0.04                                # walking left: glasses sit forward of centre
            draw_bubble(g, hx, feet, hgt * 0.55, cols[k], t, fade)
            draw_waves(g, eye_x, eye_y, t, cols[k], phase=0.3 * k, forward=-1)
            ov = g.copy()
            cv2.circle(ov, (int(eye_x), int(eye_y)), 5, cols[k], -1, cv2.LINE_AA)
            cv2.addWeighted(ov, fade, g, 1 - fade, 0, g)
            lab = labels[k]
            lx = int(hx - lab.shape[1] / 2); ly = int(hy - 46)
            box = np.zeros((lab.shape[0] + 14, lab.shape[1] + 24, 4), np.uint8)
            box[:, :, :3] = 8; box[:, :, 3] = 150
            blit(g, box, lx - 12, ly - 7, fade)
            blit(g, lab, lx, ly, fade)
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
            res = fx_element(frames, f"{WORK}/mam_rembg.png", anchor=(560, 930), scale=0.82,
                             exclude_rect=(1180, 0, 1920, 1080), appear=(0.35, 1.35),
                             reflection=dict(squash=0.45, alpha=0.28,
                                             water_poly=[(0, 900), (904, 860), (1182, 915), (1182, 1080), (0, 1080)]))
        elif fx == "sync":
            res = fx_sync(frames, t0)
        elif fx == "activate":
            res = fx_activate(frames, t0)
        elif fx == "dakota":
            res = fx_element(frames, f"{WORK}/dak_rembg.png", anchor=(1275, 760), scale=0.78,
                             exclude_rect=(0, 0, 780, 1080), appear=(0.3, 1.2), breathe=False)
        else:
            raise KeyError(fx)
        w = Writer(out)
        for fr in res:
            w.write(fr)
        w.close()


# --------------------------------------------------------------------------- picture

# No stylistic grade. Each real shot gets a primary correction instead:
# black and white points normalised to the same targets so shots match,
# a gentle S for contrast, a little saturation. Stills and the end card
# are left alone.
GRADE = "null"


def levels_lut(sample_frames, lo_p=1.5, hi_p=99.8, lo_t=0, hi_t=255, contrast=1.42, gamma=1.12):
    lum = np.concatenate([cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).ravel()[::7] for f in sample_frames])
    lo, hi = np.percentile(lum, lo_p), np.percentile(lum, hi_p)
    x = np.arange(256, dtype=np.float32)
    y = np.clip((x - lo) / max(1.0, hi - lo), 0, 1)
    y = y ** gamma
    y = y + (contrast - 1) * (y - 0.5) * (1 - np.abs(y - 0.5) * 2) * 0.9
    y = np.clip(y, 0, 1) * (hi_t - lo_t) + lo_t
    return y.astype(np.uint8)


def correct(frame, lut, sat=1.22, vib=0.22):
    g = cv2.LUT(frame, lut)
    hsv = cv2.cvtColor(g, cv2.COLOR_BGR2HSV).astype(np.float32)
    s = hsv[:, :, 1]
    hsv[:, :, 1] = np.clip(s * sat + vib * (255 - s) * (s / 255.0), 0, 255)   # vibrance lifts the muted, spares the loud
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def shot_luts():
    """Per-shot LUT from three sample frames of the prepped shot; None for stills."""
    luts = []
    t = 0.0
    for sid, src, t_in, dur, opt in SHOTS:
        if opt.get("still"):
            luts.append((t, t + dur, None))
        else:
            p = f"{SHOTS_DIR}/{sid}_fx.mp4" if opt.get("fx") else f"{SHOTS_DIR}/{sid}.mp4"
            cap = cv2.VideoCapture(p)
            n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fr = []
            for k in (0.1, 0.5, 0.9):
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(n * k))
                ok, f = cap.read()
                if ok:
                    fr.append(f)
            luts.append((t, t + dur, levels_lut(fr)))
        t += dur
    return luts


_FILM = None


def filmic(frame, i):
    """The look, applied once after the tone map: soft S with gently lifted
    warm shadows and rolled highlights, a touch of split tone, highlight
    bloom, fine grain, a faint vignette."""
    global _FILM
    if _FILM is None:
        x = np.linspace(0, 1, 256)
        s = 1 / (1 + np.exp(-(x - 0.5) * 6.2))
        s = (s - s[0]) / (s[-1] - s[0])
        y = 0.55 * s + 0.45 * x
        y = 0.035 + y * (0.985 - 0.035)
        lut = (np.clip(y, 0, 1) * 255).astype(np.uint8)
        yy = np.linspace(-1, 1, H).reshape(-1, 1); xx = np.linspace(-1, 1, W).reshape(1, -1)
        vig = 1 - 0.16 * np.clip(np.sqrt((xx * 0.85) ** 2 + yy ** 2) - 0.55, 0, 1) ** 1.6
        rng = np.random.default_rng(3)
        grains = [rng.normal(0, 2.4, (H // 2, W // 2)).astype(np.float32) for _ in range(12)]
        _FILM = (lut, vig.astype(np.float32)[:, :, None], grains)
    lut, vig, grains = _FILM
    g = cv2.LUT(frame, lut).astype(np.float32)
    lum = g.mean(axis=2, keepdims=True) / 255.0
    # split tone: cool the shadows a hair, warm the highlights a hair
    g[:, :, 0] += (1 - lum[:, :, 0]) * 5 - lum[:, :, 0] * 4
    g[:, :, 2] += lum[:, :, 0] * 6 - (1 - lum[:, :, 0]) * 3
    # bloom on the brightest 10%
    hi = np.clip((lum - 0.78) / 0.22, 0, 1)
    bl = cv2.GaussianBlur((g * hi).astype(np.float32), (0, 0), 22)
    g = g + bl * 0.16
    g = g * vig
    grain = cv2.resize(grains[i % len(grains)], (W, H), interpolation=cv2.INTER_LINEAR)
    g = g + grain[:, :, None] * (0.5 + 0.5 * (1 - lum))
    return np.clip(g, 0, 255).astype(np.uint8)


def logo_sprites():
    word = text_sprite(BRAND, 92, "Display", INK, tracking=10)
    sub = text_sprite(BRAND_SUB, 26, "SemiBold", ACCENT, tracking=12)
    mark = np.zeros((96, 120, 4), np.uint8)
    cv2.ellipse(mark, (60, 62), (40, 40), 0, 180, 360, ACCENT_BGR + (255,), -1, cv2.LINE_AA)
    cv2.line(mark, (4, 66), (116, 66), INK[::-1] + (255,), 5, cv2.LINE_AA)
    return word, sub, mark


def draw_logo(frame, u_in, u_out, y_center):
    word, sub, mark = logo_sprites()
    al = min(u_in, u_out)
    if al <= 0:
        return
    total_w = mark.shape[1] + 34 + word.shape[1]
    x0 = (W - total_w) // 2
    dx = int(18 * (1 - u_in))
    blit(frame, mark, x0 - dx, y_center - mark.shape[0] // 2 - 8, al)
    blit(frame, word, x0 + mark.shape[1] + 34 + dx, y_center - word.shape[0] // 2 - 8, al)
    blit(frame, sub, x0 + mark.shape[1] + 34 + dx + 4, y_center + word.shape[0] // 2 - 4, al * ease_out((u_in - 0.3) / 0.7))


def letterbox(frame):
    frame[:BAR] = 0
    frame[H - BAR:] = 0
    return frame


def light_sweep(frame, u, strength=0.16):
    """A soft diagonal highlight travelling across a product still."""
    xs = np.arange(W, dtype=np.float32).reshape(1, -1)
    ys = np.arange(H, dtype=np.float32).reshape(-1, 1)
    pos = (-0.35 + 1.7 * u) * W
    d = (xs + 0.45 * ys) - pos
    band = np.exp(-(d / 260.0) ** 2) * strength
    return np.clip(frame.astype(np.float32) * (1 + band[:, :, None]) + 255 * band[:, :, None] * 0.35, 0, 255).astype(np.uint8)


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
    cards = [(c[0], c[1], card_words(c[2]), c[3] if len(c) > 3 else "bl") for c in CARDS]
    eyebrows = [(a, b, tag_sprite(txt)) for a, b, txt in EYEBROWS]
    moves = []
    # push=(from_frac, zoom, (x, y)): over the END of a shot, an eased zoom
    # that lands with (x, y) centred at `zoom`; pull=(to_frac, zoom, (x, y))
    # is the mirror at the START of a shot. Two shots that push out on one
    # thing and pull in from the same thing make a match cut (operator
    # 2026-09-22: the turntable glasses -> the glasses on his face).
    pushes = []
    for sid, _, _, dur, opt in SHOTS:
        if opt.get("move"):
            moves.append((shot_start(sid), shot_start(sid) + dur) + opt["move"])
        if opt.get("push"):
            f0, z, p = opt["push"]
            pushes.append((shot_start(sid) + f0 * dur, shot_start(sid) + dur, "push", z, p))
        if opt.get("pull"):
            f1, z, p = opt["pull"]
            pushes.append((shot_start(sid), shot_start(sid) + f1 * dur, "pull", z, p))
    tags = [(a, b, tag_sprite(txt)) for a, b, txt in TAGS]
    end = end_card_sprites()
    prod_t = shot_start("glasses")
    luts = shot_luts()
    sweep_shots = [(shot_start(sid), shot_start(sid) + dur) for sid, _, _, dur, opt in SHOTS if opt.get("sweep")]
    for i in range(frames_n):
        ok, f = cap.read()
        if not ok:
            break
        t = i / FPS
        real = True
        for sid, _, _, dur, opt in SHOTS:
            if shot_start(sid) <= t < shot_start(sid) + dur:
                real = not (opt.get("black") or opt.get("sdr") or opt.get("gen"))   # a still cut from footage takes the look too
                break
        if real:
            f = filmic(f, i)
        for a, b_ in sweep_shots:
            if a + 0.3 <= t < a + 1.9:
                f = light_sweep(f, (t - a - 0.3) / 1.6)
        for a, b_, kind, amt in moves:
            if a <= t < b_:
                u = ease((t - a) / (b_ - a))
                s = 1.0 + amt * (u if kind == "in" else 1 - u)
                M = cv2.getRotationMatrix2D((W * 0.5, H * 0.5), 0, s)
                f = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
                break
        for a, b_, kind, z, p in pushes:
            if a <= t < b_:
                u = min(1.0, max(0.0, (t - a) / (b_ - a)))
                # push accelerates INTO the cut, pull decelerates OUT of it
                s = 1.0 + (z - 1.0) * (u * u if kind == "push" else (1 - u) ** 2)
                k = (s - 1.0) / (z - 1.0)
                M = cv2.getRotationMatrix2D(p, 0, s)
                M[0, 2] += k * (W / 2 - p[0]); M[1, 2] += k * (H / 2 - p[1])
                f = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
                break
        for a, b, sp in eyebrows:
            if a <= t < b:
                al = min(ease_out((t - a) / 0.35), ease((b - t) / 0.3))
                blit(f, sp, 120, H - BAR - 52, al)
        for a, b, (words, hh), pos in cards:
            if a <= t < b:
                u_out = ease((b - t) / 0.3)
                scrim_corner(f, min(ease_out((t - a) / 0.38), u_out) * 0.38, pos)
                # "tl" puts the card top-left, for a shot whose subject owns
                # the lower left (the mammoth stands there)
                base_y = BAR + 70 if pos == "tl" else H - BAR - 74 - hh
                for k, (wx, wy, sp, sh) in enumerate(words):
                    u_in = ease_out((t - a - 0.045 * k) / 0.32)
                    if u_in <= 0:
                        continue
                    al = min(u_in, u_out)
                    dy = int(18 * (1 - u_in))
                    blit(f, sh, 120 + wx + 6, base_y + wy + 8 + dy, al * 0.6)
                    blit(f, sp, 120 + wx, base_y + wy + dy, al)
                ur = ease_out((t - a - 0.1) / 0.45)
                if ur > 0:
                    rule = np.zeros((4, int(96 * ur) + 1, 4), np.uint8)
                    rule[:, :, :3] = ACCENT_BGR; rule[:, :, 3] = int(255 * min(1, u_out))
                    blit(f, rule, 120, base_y - 22, 1.0)
        for a, b, sp in tags:
            if a <= t < b:
                al = min(ease_out((t - a) / 0.3), ease((b - t) / 0.25))
                blit(f, sp, W - 96 - sp.shape[1], BAR + 34, al)
        # white flash into the product beat
        if prod_t - 0.06 <= t < prod_t + 0.22:
            k = 1 - abs((t - prod_t) / 0.16)
            k = max(0, min(1, k)) * 0.85
            f[:] = np.clip(f.astype(np.float32) * (1 - k) + 255 * k, 0, 255).astype(np.uint8)
        if t < shot_start("pan"):
            draw_logo(f, ease_out((t - 0.15) / 0.45), ease((shot_start("pan") - 0.05 - t) / 0.3), H // 2)
        if t >= END_CARD_START - 0.5:
            u = ease((t - (END_CARD_START - 0.5)) / 0.9)
            f[:] = (f.astype(np.float32) * (1 - 0.66 * u)).astype(np.uint8)
            _, tag, rule = end
            ub = ease_out((t - END_CARD_START) / 0.7)
            ut = ease_out((t - END_CARD_START - 0.45) / 0.6)
            draw_logo(f, ub, 1.0, H // 2 - 58)
            if ub > 0:
                rw = max(2, int(rule.shape[1] * ease_out(min(1, (t - END_CARD_START) / 0.5))))
                blit(f, rule[:, :rw], (W - rw) // 2, H // 2 + 34, 1.0)
            if ut > 0:
                blit(f, tag, (W - tag.shape[1]) // 2, H // 2 + 60 + int(10 * (1 - ut)), ut)
        letterbox(f)
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


def card_words(lines):
    """Per-word sprites with layout offsets, so a card can build word by word."""
    words = []
    y = 0
    line_h = None
    for ln in lines:
        x = 0
        for wd in ln.split(" "):
            sp = text_sprite(wd, 84, "Display", INK, tracking=-2)
            sh = np.zeros_like(sp); sh[:, :, 3] = sp[:, :, 3]
            sh = cv2.GaussianBlur(sh, (0, 0), 6)
            words.append((x, y, sp, sh))
            x += sp.shape[1] + 22
            line_h = sp.shape[0]
        y += line_h - 14
    return words, y + 14


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


def scrim_corner(frame, strength, pos="bl"):
    global _SCRIM
    if _SCRIM is None:
        yy = np.linspace(0, 1, H).reshape(-1, 1)
        xx = np.linspace(0, 1, W).reshape(1, -1)
        g = np.clip((yy - 0.62) / 0.38, 0, 1) ** 1.3 * np.clip(1.05 - xx * 1.25, 0, 1) ** 0.9
        _SCRIM = {"bl": g.astype(np.float32)[:, :, None], "tl": g[::-1].astype(np.float32)[:, :, None]}
    frame[:] = (frame * (1 - _SCRIM[pos] * strength)).astype(np.uint8)


def scrim_lower_left(frame, strength):
    scrim_corner(frame, strength, "bl")


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


def shimmer(dur=1.4, f0=880, sr=48000):
    """A soft materialise: a rising filtered-noise sweep under a quiet chord."""
    n = int(dur * sr); t = np.arange(n) / sr
    rng = np.random.default_rng(11)
    noise = rng.standard_normal(n).astype(np.float32)
    # simple one-pole sweep, cutoff rising
    out = np.zeros(n, np.float32); y = 0.0
    for k in range(n):
        a = 0.002 + 0.06 * (k / n) ** 2
        y = y + a * (noise[k] - y)
        out[k] = y
    out = out - np.convolve(out, np.ones(600) / 600, mode="same")     # high-pass
    env = np.exp(-((t - dur * 0.45) / (dur * 0.28)) ** 2)
    chord = sum(np.sin(2 * np.pi * f0 * r * t + p) for r, p in ((1.0, 0.0), (1.5, 1.3), (2.0, 2.1), (2.5, 0.7)))
    chord = chord / 4 * np.exp(-t * 2.2) * np.clip(t / 0.05, 0, 1)
    sig = out * env * 2.2 + chord * 0.35
    sig = sig / (np.abs(sig).max() + 1e-6)
    return np.stack([sig, sig], 1).astype(np.float32)


def sub_hit(dur=0.9, sr=48000):
    n = int(dur * sr); t = np.arange(n) / sr
    f = 62 * np.exp(-t * 3.5) + 38
    sig = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-t * 4.2)
    return np.stack([sig, sig], 1).astype(np.float32)


def stage_audio():
    n = int(TOTAL * SR)
    bus = np.zeros((n, 2), np.float32)
    S = shot_start
    if AUDIO in ("ambience", "ambience+vo", "score"):
        # Operator, 2026-09-21: no score -- "generic falls sounds over the
        # background"; 2026-09-22: louder when the falls are in frame or
        # close, and the narrator on top. One bed, the falls, its level
        # following AMBIENCE_LEVELS shot by shot (0.35s glides at the cuts).
        amb = load_audio(AMBIENCE, 2.0, TOTAL + 1)
        if len(amb) < n:
            amb = np.vstack([amb] * (int(np.ceil(n / max(1, len(amb)))) + 1))
        amb = amb[:n]
        pts, t = [(0, -60)], 0.0
        for sid, _, _, dur, _ in SHOTS:
            lvl = AMBIENCE_LEVELS.get(sid, -30)
            pts += [(t + 0.35, lvl), (t + dur, lvl)]
            t += dur
        pts += [(END_CARD_START + 1.0, -30), (TOTAL - 0.3, -60)]
        pts = sorted(pts)
        amb *= env_points(pts, n)
        if AUDIO == "ambience":
            write_wav(f"{WORK}/mix.wav", amb)
            return
        vo = np.zeros((n, 2), np.float32)
        say = narrator()
        for at, text in VO:
            p = f"{WORK}/_vo_{int(at*10)}.wav"
            say(text, p)
            a = load_audio(p)
            a = fade_edges(a, 0.02, 0.05) * db(-1)
            i0 = int(at * SR)
            k = min(len(a), n - i0)
            vo[i0:i0 + k] += a[:k]
            print(f"  vo {at:5.1f}s {len(a)/SR:4.1f}s  {text}")
        bed = amb
        if AUDIO == "score":
            # the score: under everything, restrained; lifts as the glasses
            # come online (markers), sits back under the story beats, lifts
            # again for the product and rides out under the end card.
            hit = S("markers")
            m = load_audio(MUSIC, MUSIC_OFFSET, TOTAL + 1)[:n]
            m *= env_points([(0, -26), (S("pan"), -22), (S("map"), -20), (hit - 0.05, -20), (hit, -14),
                             (S("mammoth"), -16), (S("glasses") - 0.1, -16), (S("glasses"), -13),
                             (S("sync"), -15), (END_CARD_START, -13), (TOTAL - 1.2, -13), (TOTAL - 0.05, -50)], n)
            bed = bed + m

            def place(sig, at, gain_db):
                sig = sig * db(gain_db); i0 = int(at * SR); k = min(len(sig), n - i0)
                if k > 0:
                    bed[i0:i0 + k] += sig[:k]

            def sfx(name, at, gain_db, trim=None):
                s_ = load_audio(f"{SFX}/{name}.wav")
                if trim:
                    s_ = fade_edges(s_[:int(trim * SR)], 0.005, min(0.25, trim / 2))
                place(s_, at, gain_db)

            # a few placed effects, all quiet: the activation, the lock-on,
            # the transformation, the product, the end card
            place(shimmer(), S("glasscu") + 0.35, -20)
            sfx("whoosh", S("map") + 2.3, -24, trim=0.9)           # the push in on YOU ARE HERE
            sfx("pop", S("markers") + 0.9, -24)
            sfx("pop", S("markers") + 1.5, -24)
            place(shimmer(1.8, 660), S("mammoth") + 0.3, -18)
            place(sub_hit(), S("mammoth") + 0.55, -14)
            place(shimmer(1.4, 740), S("dakota") + 0.25, -19)
            sfx("whoosh", S("glasses") - 0.08, -22, trim=0.6)
            sfx("whoosh", S("worn") - 0.25, -23, trim=0.7)          # the match cut onto his face
            sfx("boom", END_CARD_START, -18)
        env = np.abs(vo[:, 0])
        kern = int(0.08 * SR)
        env = np.convolve(env, np.ones(kern) / kern, mode="same")
        duck = 1 - 0.45 * np.clip(env / 0.02, 0, 1)
        duck = np.convolve(duck, np.ones(int(0.15 * SR)) / int(0.15 * SR), mode="same")[:, None]
        write_wav(f"{WORK}/mix.wav", bed * duck + vo)
        return
    hit = S("markers")                         # the glasses come online: the drop
    # music: sneaks in under the logo and the pan, lifts as he looks up, drops at the hit
    m = load_audio(MUSIC, MUSIC_OFFSET, TOTAL + 1)[:n]
    m *= env_points([(0, -18), (S("pan"), -15), (S("plaque"), -12), (S("glasscu"), -8), (hit - 0.05, -8), (hit, 0),
                     (S("glasses") - 0.1, 0), (S("glasses"), -4), (S("sync") - 0.1, -4), (S("sync"), 0),
                     (END_CARD_START, 0), (END_CARD_START + 1.2, -4), (TOTAL - 0.2, -40)], n)
    bus += m * 0.9
    # ambience: the falls, low, under the whole park
    amb = load_audio(AMBIENCE, 2.0, TOTAL + 1)
    if len(amb) < n:                      # the clip is shorter than the film: loop it
        reps = int(np.ceil(n / max(1, len(amb)))) + 1
        amb = np.vstack([amb] * reps)
    amb = amb[:n]
    amb *= env_points([(0, -60), (S("pan"), -60), (S("pan") + 0.6, -27), (S("glasses") - 0.2, -27), (S("glasses"), -60),
                       (S("sync") - 0.05, -60), (S("sync"), -27), (END_CARD_START, -27), (END_CARD_START + 1.0, -60)], n)
    bus += amb
    # natural sound per shot, light, crossfaded at the cuts
    t = 0.0
    for sid, src, t_in, dur, opt in SHOTS:
        a = load_audio(f"{SHOTS_DIR}/{sid}.wav", 0, dur)
        k = int(dur * SR)
        a = a[:k]
        if len(a) < k:
            a = np.vstack([a, np.zeros((k - len(a), 2), np.float32)])
        lvl = {"pan": -16, "falls": -9, "plaque": -24, "reading": -18, "glasscu": -20, "markers": -16,
               "mammoth": -13, "dakota": -13, "point": -16, "sync": -15, "bridge": -18, "away": -18, "close": -17}.get(sid, -60)
        a = fade_edges(a * db(lvl), 0.08, 0.12)
        i0 = int(t * SR)
        bus[i0:i0 + k] += a
        t += dur

    def place(sig, at, gain_db):
        sig = sig * db(gain_db)
        i0 = int(at * SR)
        k = min(len(sig), n - i0)
        if k > 0:
            bus[i0:i0 + k] += sig[:k]

    def sfx(name, at, gain_db, trim=None):
        s = load_audio(f"{SFX}/{name}.wav")
        if trim:
            s = s[:int(trim * SR)]
            s = fade_edges(s, 0.005, min(0.25, trim / 2))
        place(s, at, gain_db)

    riser_len = ffprobe_dur(f"{SFX}/riser.wav")
    sfx("riser", hit - riser_len, -13)
    sfx("boom", hit, -7)
    sfx("whoosh", hit - 0.05, -15)
    place(shimmer(), S("glasscu") + 0.35, -14)
    sfx("pop", S("markers") + 0.9, -19)
    sfx("pop", S("markers") + 1.5, -19)
    place(shimmer(1.8, 660), S("mammoth") + 0.3, -12)
    place(sub_hit(), S("mammoth") + 0.55, -9)
    place(shimmer(1.4, 740), S("dakota") + 0.25, -13)
    sfx("whoosh", S("glasses") - 0.08, -16, trim=0.6)
    sfx("pop", S("sync") + 0.9, -20)
    sfx("pop", S("sync") + 1.5, -22)
    sfx("boom", END_CARD_START, -13)
    write_wav(f"{WORK}/mix.wav", bus)
    # narration variant
    vo = np.zeros((n, 2), np.float32)
    from piper import PiperVoice
    v = PiperVoice.load(VOICE)
    for at, text in VO:
        p = f"{WORK}/_vo_{int(at*10)}.wav"
        with wave.open(p, "wb") as wv:
            v.synthesize_wav(text, wv)
        a = load_audio(p)
        a = fade_edges(a, 0.02, 0.05) * db(-1)
        i0 = int(at * SR)
        k = min(len(a), n - i0)
        vo[i0:i0 + k] += a[:k]
    env = np.abs(vo[:, 0])
    kern = int(0.08 * SR)
    env = np.convolve(env, np.ones(kern) / kern, mode="same")
    duck = 1 - 0.5 * np.clip(env / 0.02, 0, 1)[:, None]
    duck = np.convolve(duck[:, 0], np.ones(int(0.15 * SR)) / int(0.15 * SR), mode="same")[:, None]
    write_wav(f"{WORK}/mix_vo.wav", bus * duck + vo)


def narrator():
    """The narration engine, from spec.VOICE. "kokoro:<voice>" is Kokoro
    (82M, ONNX, CPU; a different class of voice from Piper -- operator
    2026-09-22: "this voice is not going to cut it"); anything else is a
    Piper model path. Returns say(text, wav_path)."""
    if VOICE.startswith("kokoro:"):
        import soundfile as sf
        from kokoro_onnx import Kokoro
        voice = VOICE.split(":", 1)[1]
        kd = os.path.join(HERE, "..", "vo", "kokoro")
        k = Kokoro(f"{kd}/kokoro-v1.0.onnx", f"{kd}/voices-v1.0.bin")

        def say(text, path):
            a, sr = k.create(text, voice=voice, speed=VOICE_SPEED, lang="en-us")
            sf.write(path, a, sr)
        return say
    from piper import PiperVoice
    v = PiperVoice.load(VOICE)

    def say(text, path):
        with wave.open(path, "wb") as wv:
            v.synthesize_wav(text, wv)
    return say


def write_wav(path, a):
    peak = float(np.abs(a).max())
    if peak > 0.98:
        a = a * (0.98 / peak)
    pcm = (np.clip(a, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "w") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# --------------------------------------------------------------------------- final

FINISH = "null"


def stage_final():
    os.makedirs("../out", exist_ok=True)
    outs = [("mix.wav", "ORI_promo.mp4")] if AUDIO != "full" else [("mix.wav", "ORI_promo.mp4"), ("mix_vo.wav", "ORI_promo_vo.mp4")]
    lufs = {"ambience": -20, "ambience+vo": -16, "score": -15}.get(AUDIO, -14)
    for mix, name in outs:
        run(["ffmpeg", "-v", "error", "-y", "-i", f"{WORK}/picture.mp4", "-i", f"{WORK}/{mix}",
             "-vf", FINISH, "-af", f"loudnorm=I={lufs}:TP=-1.5:LRA=9",
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
