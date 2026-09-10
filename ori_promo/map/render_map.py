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


def draw_persistent_place_inset(img, place_frames, local_t, k=1.0):
    f = place_frames[min(int(round(local_t * FPS)), len(place_frames) - 1)]
    G.small_aperture(img, dark_doc_grade(f), NODE_PLACE[0], NODE_PLACE[1], 66, G.AMBER, k=k)


def draw_spine_and_nodes(img, t, upto="zone"):
    """Draws the spine path lit up to global time t, plus every SPINE node
    at its own state. `upto` limits which nodes are eligible to render
    (e.g. during hwsw, ZONE shouldn't light even though its arrival time
    is in the future -- spine_lit_frac already handles the path length,
    this only guards node draw-calls before their own section)."""
    lit = spine_lit_frac(t)
    G.draw_path(img, SPINE_PTS, lit, k=1.0)
    for node in SPINE:
        if node is NODE_PLACE:
            continue  # drawn separately as the small footage inset
        st = spine_state(node, t)
        G.draw_node(img, node, st, k=1.0, pulse=t * 1.6)


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
    out = []
    for i in range(int(round(dur * FPS))):
        t = i / FPS
        gt = beat_start + t
        img = G.background()
        draw_persistent_place_inset(img, place_frames, t)
        draw_spine_and_nodes(img, gt)
        G.system_diagram_tag(img, k=1.0)
        if hw_t0 <= gt < hw_t1:
            lt = gt - hw_t0
            k = G.fade_k(lt, hw_t1 - hw_t0, in_t=0.3, out_margin=0.3)
            f = hero_frames[min(int(round(lt * FPS)), len(hero_frames) - 1)]
            G.small_aperture(img, f, NODE_HARDWARE[0], NODE_HARDWARE[1], 90, G.CYAN, k=k)
            G.disclosure(img, "PRODUCT VISUALIZATION", corner="tr")
            G.caption(img, lt, hw_t1 - hw_t0, CAPTIONS["hardware"])
        elif sw_t0 <= gt < sw_t1:
            lt = gt - sw_t0
            k = G.fade_k(lt, sw_t1 - sw_t0, in_t=0.3, out_margin=0.3)
            f = worn_frames[min(int(round(lt * FPS)), len(worn_frames) - 1)]
            G.small_aperture(img, f, NODE_SOFTWARE[0], NODE_SOFTWARE[1], 90, G.CYAN, k=k)
            G.disclosure(img, "PRODUCT VISUALIZATION", corner="tr")
            G.caption(img, lt, sw_t1 - sw_t0, CAPTIONS["software"])
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
EX_START = _SEC_START["examples"]
HIST_T0, HIST_T1 = EX_START + 0.0, EX_START + 5.0
ICE_T0, ICE_T1 = EX_START + 5.0, EX_START + 12.5
AUDIO_T0, AUDIO_T1 = EX_START + 12.5, EX_START + 18.0


def _examples_base(img):
    G.system_diagram_tag(img, k=1.0)
    G.draw_node(img, NODE_ZONE, "done", k=0.9)
    for br in BRANCHES:
        G.draw_path(img, [(NODE_ZONE[0], NODE_ZONE[1]), (br[0], br[1])], 0.0, k=0.5, width=2)


def build_examples_hist():
    seg_dur = HIST_T1 - HIST_T0
    dak_frames = read_plate(os.path.join(RAW, "IMG_DAK1.MOV"), seg_dur)
    out = []
    for i in range(int(round(seg_dur * FPS))):
        lt = i / FPS
        img = G.background()
        _examples_base(img)
        lit = min(1.0, lt / 0.6)
        G.draw_path(img, [(NODE_ZONE[0], NODE_ZONE[1]), (NODE_HISTORICAL[0], NODE_HISTORICAL[1])], lit, k=1.0, width=2)
        k = G.fade_k(lt, seg_dur, in_t=0.3, out_margin=0.3)
        f = dak_frames[min(i, len(dak_frames) - 1)]
        r = 130  # larger scale, entering from the branch line (left)
        G.small_aperture(img, f, NODE_HISTORICAL[0], NODE_HISTORICAL[1], r, G.CYAN, k=k)
        G.disclosure(img, "VISUALIZATION", corner="tr")
        G.caption(img, lt, seg_dur, CAPTIONS["historical"])
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
        G.draw_path(img, [(NODE_ZONE[0], NODE_ZONE[1]), (NODE_HISTORICAL[0], NODE_HISTORICAL[1])], 1.0, k=0.6, width=2)
        lit = min(1.0, lt / 0.6)
        G.draw_path(img, [(NODE_ZONE[0], NODE_ZONE[1]), (NODE_ICEAGE[0], NODE_ICEAGE[1])], lit, k=1.0, width=2)
        k = G.fade_k(lt, seg_dur, in_t=0.3, out_margin=0.3)
        f = ice_frames[min(i, len(ice_frames) - 1)]
        r = 170  # largest of the three -- longest hold, biggest scale
        G.small_aperture(img, f, NODE_ICEAGE[0], NODE_ICEAGE[1], r, G.CYAN, k=k)
        G.disclosure(img, "VISUALIZATION", corner="tr")
        G.caption(img, lt, seg_dur, CAPTIONS["iceage"])
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
        G.draw_path(img, [(NODE_ZONE[0], NODE_ZONE[1]), (NODE_HISTORICAL[0], NODE_HISTORICAL[1])], 1.0, k=0.6, width=2)
        G.draw_path(img, [(NODE_ZONE[0], NODE_ZONE[1]), (NODE_ICEAGE[0], NODE_ICEAGE[1])], 1.0, k=0.6, width=2)
        lit = min(1.0, lt / 0.4)
        G.draw_path(img, [(NODE_ZONE[0], NODE_ZONE[1]), (NODE_AUDIO[0], NODE_AUDIO[1])], lit, k=1.0, width=2)
        k = G.fade_k(lt, seg_dur, in_t=0.25, out_margin=0.3)
        r = 95  # smallest, fastest of the three
        G.small_aperture(img, still_dim, NODE_AUDIO[0], NODE_AUDIO[1], r, G.CYAN, k=k)
        G.caption(img, lt, seg_dur, CAPTIONS["audio"])
        out.append(from_pil(img))
    return out


def build_examples():
    return build_examples_hist() + build_examples_ice() + build_examples_audio()


def build_loop():
    dur = 14.0
    beat_start = _SEC_START["loop"]
    place_frames = read_clip("6790", 10.0, dur)
    out = []
    for i in range(int(round(dur * FPS))):
        t = i / FPS
        gt = beat_start + t
        img = G.background()
        G.system_diagram_tag(img, k=1.0)
        draw_persistent_place_inset(img, place_frames, t)
        lit = loop_lit_frac(gt)
        G.draw_path(img, LOOP_PTS, lit, k=1.0, width=3)
        for idx, node in enumerate(LOOP_NODES):
            arrive = LOOP_ARRIVALS[idx]
            st = "pending" if gt < arrive - 1.0 else ("active" if gt < arrive else "done")
            G.draw_node(img, node, st, k=1.0, pulse=gt * 1.6)
        if gt >= LOOP_ARRIVALS[-1] - 0.3:
            G.caption(img, gt - (LOOP_ARRIVALS[-1] - 0.3), 3.3, "BORROW → EXPERIENCE → RETURN → UPDATE")
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
