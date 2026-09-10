#!/usr/bin/env python3
"""v36 "HOW THE SYSTEM WORKS" -- render engine. Run from this directory:

    python3 render_map.py [section ...]

A fourth, independent engine -- not a copy of one/'s AR-anchor system,
field/'s paper-panel cards, or walk/'s plain-white minimalism. What it
shares with those three is only the genuinely generic layer (reading raw
footage, encoding H.264); the dark animated system-map grammar is its
own, built for r178's brief.
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

import graphics_map as G
from spec_map import (W, H, FPS, TOTAL, SECTIONS, RAW, SPINE, BRANCHES,
                       LOOP_NODES, NODE_PLACE, NODE_HARDWARE, NODE_SOFTWARE,
                       NODE_ZONE, NODE_HISTORICAL, NODE_ICEAGE, NODE_AUDIO,
                       NODE_BORROW, NODE_EXPERIENCE, NODE_RETURN, NODE_UPDATE,
                       CAPTIONS, SPINE_ARRIVALS, LOOP_ARRIVALS)

OUT = "out_map"
_HERE = os.path.dirname(os.path.abspath(__file__))
_SEC_START = {s: st for s, st, d, desc in SECTIONS}


def read_clip(clip, tin, dur, fps=FPS, w=W, h=H):
    n = int(round(dur * fps))
    vf = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={fps}"
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{tin}", "-i", f"{RAW}/IMG_{clip}.MOV",
         "-frames:v", str(n), "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
        capture_output=True)
    b = r.stdout
    got = len(b) // (w * h * 3)
    if got < n:
        raise SystemExit(f"{clip}@{tin}: wanted {n} frames, got {got}: {r.stderr.decode()[-500:]}")
    a = np.frombuffer(b[:n * w * h * 3], np.uint8).reshape(n, h, w, 3)
    return [f.copy() for f in a]


def read_plate(path, dur, fps=FPS, w=W, h=H):
    n = int(round(dur * fps))
    vf = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={fps}"
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-frames:v", str(n),
         "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
        capture_output=True)
    b = r.stdout
    got = len(b) // (w * h * 3)
    if got < n:
        raise SystemExit(f"{path}: wanted {n} frames, got {got}: {r.stderr.decode()[-500:]}")
    a = np.frombuffer(b[:n * w * h * 3], np.uint8).reshape(n, h, w, 3)
    return [f.copy() for f in a]


def build_photo_zoom(src, dur, cap=1.05, fps=FPS):
    n = int(round(dur * fps))
    rate = (cap - 1.0) / (n * 0.5)
    vf = (f"scale=3840:2160:flags=lanczos,"
          f"zoompan=z='min(1.0+{rate}*on,{cap})':d={n}:x='iw/2-(iw/zoom/2)':"
          f"y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={fps}")
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-loop", "1", "-i", src, "-t", str(dur),
         "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True)
    b = r.stdout
    got = len(b) // (W * H * 3)
    if got < n:
        raise SystemExit(f"photo_zoom {src}: wanted {n}, got {got}: {r.stderr.decode()[-500:]}")
    a = np.frombuffer(b[:n * W * H * 3], np.uint8).reshape(n, H, W, 3)
    return [f.copy() for f in a]


def dark_doc_grade(bgr):
    """A cooler, slightly darker, slightly desaturated treatment for real
    footage inside the system-map documentary mood -- distinct from
    walk's natural_grade (barely graded at all) and field's daylight_grade
    (warm/bright). Footage stays clearly recognizable; r178 is explicit
    that it must, not become decorative background."""
    x = bgr.astype(np.float32) / 255.0
    gray = x.mean(axis=2, keepdims=True)
    x = x * 0.86 + gray * 0.14        # slight desaturation
    x = np.clip((x - 0.5) * 1.05 + 0.5 - 0.06, 0, 1)  # small contrast + darken
    return x * 255.0


def to_rgba(bgr_float):
    return Image.fromarray(np.clip(bgr_float, 0, 255).astype(np.uint8)[:, :, ::-1]).convert("RGBA")


def from_pil(img):
    rgb = np.array(img.convert("RGB"))
    return rgb[:, :, ::-1].astype(np.float32)


def encode(frames, dst, fps=FPS, crf=15):
    enc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
         "-s", f"{W}x{H}", "-r", str(fps), "-i", "-", "-an",
         "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p", dst],
        stdin=subprocess.PIPE)
    for f in frames:
        enc.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes())
    enc.stdin.close()
    enc.wait()


def build_arrival_interp(points, arrival_times):
    """Returns f(global_t) -> lit_frac (0..1), a straight time-interpolation
    between each waypoint's cumulative-path-length fraction. len(points)
    must equal len(arrival_times)."""
    total = G.path_length(points)
    fracs = [0.0]
    acc = 0.0
    for a, b in zip(points, points[1:]):
        acc += ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
        fracs.append(acc / total if total > 0 else 0.0)
    times = list(arrival_times)

    def f(t):
        if t <= times[0]:
            return fracs[0]
        if t >= times[-1]:
            return fracs[-1]
        return float(np.interp(t, times, fracs))
    return f


SPINE_PTS = [(n[0], n[1]) for n in SPINE]
spine_lit_frac = build_arrival_interp(SPINE_PTS, SPINE_ARRIVALS)
LOOP_PTS = [(n[0], n[1]) for n in LOOP_NODES] + [(LOOP_NODES[0][0], LOOP_NODES[0][1])]
loop_lit_frac = build_arrival_interp(LOOP_PTS, LOOP_ARRIVALS)


def spine_state(node, t):
    """pending / active / done for a SPINE node at global time t, based on
    SPINE_ARRIVALS."""
    idx = SPINE.index(node)
    arrive = SPINE_ARRIVALS[idx]
    if t < arrive - 1.2:
        return "pending"
    if t < arrive:
        return "active"
    return "done"


# r181: draw_persistent_place_inset() and draw_spine_and_nodes() (the
# small-circle PLACE inset and the full HARDWARE/SOFTWARE/ZONE spine
# overlay) were removed here -- build_hwsw() no longer uses them, per
# r180's relayout (a rounded-rect PLACE window and a single big shared
# aperture slot replace them). Removed rather than left unused.


def build_place():
    dur = 7.0
    frames = read_clip("6790", 10.0, dur)
    out = []
    for i, f in enumerate(frames):
        t = i / FPS
        img = G.full_bleed(dark_doc_grade(f))
        G.system_diagram_tag(img, k=1.0)
        G.section_label(img, t, dur, "THE PLACE")
        if t >= 2.0:
            k = G.fade_k(t - 2.0, dur - 2.0, in_t=1.2, no_out=True)
            st = "active" if t < 6.0 else "done"
            G.draw_node(img, NODE_PLACE, st, k=k, pulse=t * 1.6)
        out.append(from_pil(img))
    return out


# r181 (per r180's mobile-legibility review): the hwsw/examples/loop
# geometry below is a genuine relayout, not a font tweak -- apertures
# at r180's exact minimum sizes (460px/620px diameter, 1050x620/600x338
# rects), so a mobile-width preview reads the imagery and labels without
# zooming. place/zone/close are untouched (all three PASSED).
HW_BIG_CENTER = (960, 430)
HW_BIG_R = 240                    # 480px diameter > r180's 460px minimum
# top-left, not bottom-left: the 52px-font caption ("PLACE-BASED
# EXPERIENCE — SOFTWARE" is wide) is centered at x=960 and needed
# vertical room below the big aperture -- a bottom-left rect collided
# with the caption box in testing. Top-left leaves the whole bottom
# band clear, and doesn't touch the aperture (620<720, disjoint in x
# regardless of y).
HW_PLACE_RECT = (60, 60, 560, 320)   # x0,y0,w,h -- 560x320 > 520x292 minimum


def build_hwsw():
    dur = 11.0
    beat_start = _SEC_START["hwsw"]
    place_frames = read_clip("6790", 10.0, dur)
    hero_src = os.path.join(_HERE, "..", "ai", "hero", "glasses_hero_chatgpt.jpg")
    worn_src = os.path.join(_HERE, "..", "ai", "worn", "product_worn_falls_park_plate_chatgpt.jpg")
    # visible windows in GLOBAL time
    hw_t0, hw_t1 = 10.0, 14.5
    sw_t0, sw_t1 = 14.5, 18.0
    hero_frames = build_photo_zoom(hero_src, hw_t1 - hw_t0, cap=1.05)
    worn_frames = build_photo_zoom(worn_src, sw_t1 - sw_t0, cap=1.06)
    px, py, pw, ph = HW_PLACE_RECT
    path_pts = [(px + pw, py + ph // 2), HW_BIG_CENTER]
    out = []
    for i in range(int(round(dur * FPS))):
        t = i / FPS
        gt = beat_start + t
        img = G.background()
        f = place_frames[min(i, len(place_frames) - 1)]
        G.rect_aperture(img, dark_doc_grade(f), px + pw // 2, py + ph // 2, pw, ph, G.AMBER)
        lit = min(1.0, t / 1.0)
        G.draw_path(img, path_pts, lit, k=1.0, width=3)
        G.system_diagram_tag(img, k=1.0, font_size=26)
        if hw_t0 <= gt < hw_t1:
            lt = gt - hw_t0
            k = G.fade_k(lt, hw_t1 - hw_t0, in_t=0.3, out_margin=0.3)
            f2 = hero_frames[min(int(round(lt * FPS)), len(hero_frames) - 1)]
            G.small_aperture(img, f2, HW_BIG_CENTER[0], HW_BIG_CENTER[1], HW_BIG_R, G.CYAN, k=k)
            G.disclosure(img, "PRODUCT VISUALIZATION", corner="tr", font_size=38)
            G.caption(img, lt, hw_t1 - hw_t0, CAPTIONS["hardware"], y_frac=0.75, font_size=52)
        elif sw_t0 <= gt < sw_t1:
            lt = gt - sw_t0
            k = G.fade_k(lt, sw_t1 - sw_t0, in_t=0.3, out_margin=0.3)
            f2 = worn_frames[min(int(round(lt * FPS)), len(worn_frames) - 1)]
            G.small_aperture(img, f2, HW_BIG_CENTER[0], HW_BIG_CENTER[1], HW_BIG_R, G.CYAN, k=k)
            G.disclosure(img, "PRODUCT VISUALIZATION", corner="tr", font_size=38)
            G.caption(img, lt, sw_t1 - sw_t0, CAPTIONS["software"], y_frac=0.75, font_size=52)
        out.append(from_pil(img))
    return out


def build_zone():
    dur = 13.0
    beat_start = _SEC_START["zone"]
    frames = read_clip("6805", 20.0, dur)
    out = []
    for i, f in enumerate(frames):
        t = i / FPS
        gt = beat_start + t
        img = G.full_bleed(dark_doc_grade(f))
        G.system_diagram_tag(img, k=1.0)
        # thin spine overlay, arriving at ZONE mid-section
        G.draw_path(img, SPINE_PTS, spine_lit_frac(gt), k=0.55, width=2, glow=False)
        st = spine_state(NODE_ZONE, gt)
        G.draw_node(img, NODE_ZONE, st, k=0.9, pulse=gt * 1.6)
        if gt >= 21.0:
            lt = gt - 21.0
            half = (dur - (21.0 - beat_start)) / 2
            if lt < half:
                G.caption(img, lt, half, "RECOGNIZES THE EXPERIENCE ZONE")
            else:
                G.caption(img, lt - half, dur - (21.0 - beat_start) - half, "ANCHORS CONTENT TO THIS PLACE")
        out.append(from_pil(img))
    return out


# r178's brief: three unequal, moving examples branching off ZONE, varied
# duration/scale/entry -- explicitly not three equal holds. Each is its
# own function (not one 18s loop) so each can render as its own process:
# the combined build kept getting killed by the harness's background
# wall-clock limit at 540 frames with per-frame branch-path work; three
# ~5-7.5s renders each finish well inside it.
#
# r181 (per r180): the three small branch apertures (r130/170/95) read
# as "icons in a diagram", not proof-of-concept images. Replaced with a
# single shared big-aperture slot (>=620px diameter, comfortably over
# r180's minimum) that each example occupies in turn -- entry direction
# still differs per example (a slide-in offset from left/top/right,
# eased over the first 0.5s), which is what "distinct entry direction"
# actually asks for; it doesn't require three separate static branch
# positions. The small ZONE origin marker moves to a corner with r180's
# own explicit permission ("the inactive branch map may shrink or move
# aside"), connected to the big slot by one thin line.
EX_START = _SEC_START["examples"]
HIST_T0, HIST_T1 = EX_START + 0.0, EX_START + 5.0
ICE_T0, ICE_T1 = EX_START + 5.0, EX_START + 12.5
AUDIO_T0, AUDIO_T1 = EX_START + 12.5, EX_START + 18.0

EX_ZONE_MARKER = (160, 150, "ZONE", "amber", "zone")
EX_BIG_CENTER = (1280, 470)
EX_BIG_R = 315  # 630px diameter > r180's 620px minimum


def _examples_base(img):
    G.system_diagram_tag(img, k=1.0, font_size=26)
    G.draw_node(img, EX_ZONE_MARKER, "done", k=0.9, font_size=30)
    G.draw_path(img, [(EX_ZONE_MARKER[0], EX_ZONE_MARKER[1]), EX_BIG_CENTER], 1.0, k=0.5, width=2, glow=False)


def _example_entry_aperture(img, f, seg_dur, lt, dx, dy):
    k = G.fade_k(lt, seg_dur, in_t=0.3, out_margin=0.3)
    e = G.ease(min(1.0, lt / 0.5))
    cx = int(EX_BIG_CENTER[0] + dx * (1 - e))
    cy = int(EX_BIG_CENTER[1] + dy * (1 - e))
    G.small_aperture(img, f, cx, cy, EX_BIG_R, G.CYAN, k=k)
    return k


def build_examples_hist():
    seg_dur = HIST_T1 - HIST_T0
    dak_frames = read_plate(os.path.join(RAW, "IMG_DAK1.MOV"), seg_dur)
    out = []
    for i in range(int(round(seg_dur * FPS))):
        lt = i / FPS
        img = G.background()
        _examples_base(img)
        f = dak_frames[min(i, len(dak_frames) - 1)]
        _example_entry_aperture(img, f, seg_dur, lt, dx=-260, dy=0)  # enters from the left
        G.disclosure(img, "VISUALIZATION", corner="tr", font_size=38)
        G.caption(img, lt, seg_dur, CAPTIONS["historical"], y_frac=0.82, font_size=52)
        out.append(from_pil(img))
    return out


def build_examples_ice():
    seg_dur = ICE_T1 - ICE_T0
    iceage_src = os.path.join(_HERE, "..", "ai", "iceage", "iceage_falls_visualization_r172_chatgpt.jpg")
    ice_frames = build_photo_zoom(iceage_src, seg_dur, cap=1.04)
    out = []
    for i in range(int(round(seg_dur * FPS))):
        lt = i / FPS
        img = G.background()
        _examples_base(img)
        f = ice_frames[min(i, len(ice_frames) - 1)]
        _example_entry_aperture(img, f, seg_dur, lt, dx=0, dy=-260)  # enters from the top
        G.disclosure(img, "VISUALIZATION", corner="tr", font_size=38)
        G.caption(img, lt, seg_dur, CAPTIONS["iceage"], y_frac=0.82, font_size=52)
        out.append(from_pil(img))
    return out


def build_examples_audio():
    seg_dur = AUDIO_T1 - AUDIO_T0
    still = read_clip("6805", 33.0, 0.1)[0]
    still_dim = dark_doc_grade(still) * 0.55 + np.array([14, 16, 19])[::-1] * 0.45
    out = []
    for i in range(int(round(seg_dur * FPS))):
        lt = i / FPS
        img = G.background()
        _examples_base(img)
        _example_entry_aperture(img, still_dim, seg_dur, lt, dx=260, dy=0)  # enters from the right
        G.caption(img, lt, seg_dur, CAPTIONS["audio"], y_frac=0.82, font_size=52)
        out.append(from_pil(img))
    return out


def build_examples():
    return build_examples_hist() + build_examples_ice() + build_examples_audio()


# r181 (per r180): the loop diamond and its PLACE inset were "physically
# too small" and read as decoration. loop_lit_frac() (built from
# spec_map.py's small-scale LOOP_PTS) still supplies the correct
# fraction-of-travel at each moment -- it only depends on the shape's
# segment-length RATIOS, which are identical at any scale -- so it's
# reused unchanged and simply applied to this larger geometry.
LG_CENTER = (760, 460)
LG_RX, LG_RY = 530, 315               # bounding box 1060x630 > r180's 1050x620 minimum
LG_BORROW = (LG_CENTER[0] - LG_RX, LG_CENTER[1], "BORROW", "neutral", "loop")
LG_EXPERIENCE = (LG_CENTER[0], LG_CENTER[1] - LG_RY, "EXPERIENCE", "neutral", "loop")
LG_RETURN = (LG_CENTER[0] + LG_RX, LG_CENTER[1], "RETURN", "neutral", "loop")
LG_UPDATE = (LG_CENTER[0], LG_CENTER[1] + LG_RY, "UPDATE", "neutral", "loop")
LG_NODES = [LG_BORROW, LG_EXPERIENCE, LG_RETURN, LG_UPDATE]
LG_PTS = [(n[0], n[1]) for n in LG_NODES] + [(LG_BORROW[0], LG_BORROW[1])]
LG_SUB = {"BORROW": "Reusable hardware", "EXPERIENCE": "Place-based story",
          "RETURN": "Destination-managed", "UPDATE": "Software changes"}
# PLACE window: top-right, clear of every node's label zone AND the
# final "BORROW -> EXPERIENCE -> RETURN -> UPDATE" caption (which sits
# at the bottom, y~965-1043) -- a bottom-right placement was tried first
# and collided with that caption's box (both wide, both right-of-center
# at the sizes r180 requires). Top-right only grazes RETURN's ring by a
# few px at the very corner, which its own rounded-rect mask corner
# radius (28px) cuts away.
LG_PLACE_RECT = (1600, 270, 600, 338)  # cx, cy, w, h -- 600x338 == r180's minimum exactly


def build_loop():
    dur = 14.0
    beat_start = _SEC_START["loop"]
    place_frames = read_clip("6790", 10.0, dur)
    out = []
    for i in range(int(round(dur * FPS))):
        t = i / FPS
        gt = beat_start + t
        img = G.background()
        G.system_diagram_tag(img, k=1.0, font_size=26)
        f = place_frames[min(i, len(place_frames) - 1)]
        cx, cy, w, h = LG_PLACE_RECT
        G.rect_aperture(img, dark_doc_grade(f), cx, cy, w, h, G.AMBER)
        lit = loop_lit_frac(gt)
        G.draw_path(img, LG_PTS, lit, k=1.0, width=4)
        for idx, node in enumerate(LG_NODES):
            arrive = LOOP_ARRIVALS[idx]
            st = "pending" if gt < arrive - 1.0 else ("active" if gt < arrive else "done")
            # the supporting phrase shows only near its own node's arrival
            # (each ~2.1s window, spaced >=3.5s apart -- never two at once)
            # rather than all four simultaneously: reads as "explained one
            # at a time" as the path reaches each node, and keeps every
            # label box clear of the persistent PLACE window at every gt,
            # not just most of the section.
            show_sub = (arrive - 0.3) <= gt <= (arrive + 1.8)
            G.draw_node(img, node, st, k=1.0, pulse=gt * 1.6, font_size=52,
                        sub_label=LG_SUB[node[2]] if show_sub else None,
                        sub_font_size=38, ring_r=26)
        if gt >= LOOP_ARRIVALS[-1] - 0.3:
            G.caption(img, gt - (LOOP_ARRIVALS[-1] - 0.3), 3.3,
                      "BORROW → EXPERIENCE → RETURN → UPDATE", y_frac=0.93, font_size=52)
        out.append(from_pil(img))
    return out


def build_close():
    dur = 11.0
    end_dur = 3.5
    frames = read_clip("6790", 20.0, dur)
    out = []
    for i, f in enumerate(frames):
        t = i / FPS
        img = G.full_bleed(dark_doc_grade(f))
        if t < dur - end_dur:
            G.system_diagram_tag(img, k=1.0)
        if t >= dur - end_dur:
            G.end_card(img, t - (dur - end_dur), end_dur,
                       "OPEN RANGE INTERACTIVE",
                       "PLACE-BASED STORIES, EXPERIENCED WHERE THEY BELONG")
        out.append(from_pil(img))
    return out


BUILDERS = {
    "place": build_place, "hwsw": build_hwsw, "zone": build_zone,
    "examples": build_examples, "loop": build_loop, "close": build_close,
    # examples' three branches also run as independent, smaller targets --
    # each is its own process, so each finishes well inside the harness's
    # background wall-clock limit where the combined 540-frame single
    # call did not.
    "examples_hist": build_examples_hist, "examples_ice": build_examples_ice,
    "examples_audio": build_examples_audio,
}

EXAMPLES_PARTS = ["examples_hist", "examples_ice", "examples_audio"]


def concat_examples_parts():
    """Stitches the three independently-rendered example parts into the
    single examples_t.mp4 the rest of the pipeline expects."""
    missing = [p for p in EXAMPLES_PARTS if not os.path.exists(f"{OUT}/{p}_t.mp4")]
    if missing:
        raise SystemExit(f"concat_examples_parts: missing {missing}, render them first")
    with open(f"{OUT}/_examples_concat.txt", "w") as fh:
        for p in EXAMPLES_PARTS:
            fh.write(f"file '{os.path.abspath(OUT)}/{p}_t.mp4'\n")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", f"{OUT}/_examples_concat.txt", "-c", "copy", f"{OUT}/examples_t.mp4"],
                   check=True)
    print("  examples composed (concatenated from 3 parts)")


def main(only=None):
    os.makedirs(OUT, exist_ok=True)
    if only and set(only) & set(EXAMPLES_PARTS):
        for name in only:
            if name in EXAMPLES_PARTS:
                frames = BUILDERS[name]()
                encode(frames, f"{OUT}/{name}_t.mp4")
                print(f"  {name} composed ({len(frames)} frames)")
        if all(os.path.exists(f"{OUT}/{p}_t.mp4") for p in EXAMPLES_PARTS):
            concat_examples_parts()
        return
    for name, start, dur, desc in SECTIONS:
        if only and name not in only:
            continue
        if name == "examples":
            for part in EXAMPLES_PARTS:
                frames = BUILDERS[part]()
                encode(frames, f"{OUT}/{part}_t.mp4")
                print(f"  {part} composed ({len(frames)} frames)")
            concat_examples_parts()
            continue
        frames = BUILDERS[name]()
        assert len(frames) == int(round(dur * FPS)), \
            f"{name}: built {len(frames)} frames, expected {int(round(dur*FPS))}"
        encode(frames, f"{OUT}/{name}_t.mp4")
        print(f"  {name} composed ({len(frames)} frames)")


if __name__ == "__main__":
    main(sys.argv[1:] or None)
