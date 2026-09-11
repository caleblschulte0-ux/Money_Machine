#!/usr/bin/env python3
"""v37 "THE WORLD / THE LAYER" -- render engine. Run from this directory:

    python3 render_layer.py <target> [target ...]

A fifth, independent engine -- not a copy of one/'s AR-anchor system,
field/'s paper-panel cards, walk/'s plain-white minimalism, or map/'s
dark node-graph. What it shares with those four is only the genuinely
generic layer (reading raw footage, encoding H.264); the bright wipe-
reveal grammar is its own, built for r184's brief.

TWO-PHASE RENDER, per this build's own harness-timeout discovery: a
single real-footage/plate read (read_clip/read_plate/build_photo_zoom)
on this machine measured anywhere from ~11s to ~55s of wall clock for
just 8s of 1920x1080 footage -- highly variable, and a section needing
TWO such reads back-to-back (a "world" backdrop plus a "layer" plate)
plus its own per-frame drawing loop and final encode reliably got
SIGKILLed (exit 137) as a background process before finishing. v36's own
CLAUDE.md-documented fix for its heaviest section (splitting one build
into independently-invoked sub-processes) is generalized here one level
further: EVERY heavy read is its OWN sub-process, caching a small
bright_edit_grade'd intermediate clip to out_layer/_src_<key>.mp4 (a
"source" target). Re-decoding an already-1080p h264 file measured ~2.4s
for 240 frames -- fast enough that the actual per-section compositing
pass (a "section" target) only ever does cheap re-decodes, never a raw
footage read, so its own wall clock stays small and predictable
regardless of how slow a fresh raw read happens to run that minute.

Footage windows (all reused from stretches this handoff has already
verified clean across multiple prior rounds):
  - IMG_6790 is only 32.0s long; its 8-31s stretch has been used clean
    by v36's place/hwsw/close across three separate rounds. hook/
    borrow/close all draw from inside that stretch here.
  - r199 (ChatGPT's r198 review: the wearer disappears for 46 straight
    seconds, 00:20-01:06, because recognize/examples/loop all used
    IMG_6805's peopleless 20-33/26-38s windows): recognize, examples_
    hist, examples_ice, examples_audio and loop now all draw from ONE
    continuous, unbroken take of the wearer -- IMG_6794 (54.4s, a
    locked-off wide shot at the stone overlook wall, the wearer facing
    away/across the falls, gesturing/pointing throughout; already
    verified as "the wearer" by one/spec_one.py's own prior scouting).
    0.0-12.0s -> recognize, 12.0-20.0s -> examples_hist, 20.0-29.5s ->
    examples_ice, 29.5s (single frame) -> examples_audio's still,
    29.5-41.5s -> loop: one unbroken 41.5s span out of the clip's 54.4s
    (12.9s spare), so the wearer is on screen, in the SAME real shot,
    for the whole recognize->examples->loop stretch -- never a cut to
    a different, peopleless clip. The AR window position (WIN_CX/CY/
    W/H, shared with recognize's own ZONE_CX/CY/W/H) was verified
    against this specific take at 4s intervals across its full 0-44s
    range plus the exact examples_audio anchor timestamp: the wearer
    stays right-of-frame throughout, never entering the window's
    bounds (roughly the left third of frame, over open falls/sky).
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

import graphics_layer as G
from spec_layer import W, H, FPS, TOTAL, SECTIONS, CAPTIONS, LOOP_WORDS

OUT = "out_layer"
_HERE = os.path.dirname(os.path.abspath(__file__))

RAW = "../raw"
HERO_SRC = os.path.join(_HERE, "..", "ai", "hero", "glasses_hero_chatgpt.jpg")
WORN_SRC = os.path.join(_HERE, "..", "ai", "worn", "product_worn_falls_park_plate_chatgpt.jpg")
ICEAGE_SRC = os.path.join(_HERE, "..", "ai", "iceage", "iceage_falls_visualization_r172_chatgpt.jpg")
# r210: hook gets its own bespoke plate (ChatGPT's r209 delivery) matching
# the exact real railing/two-sign overlook hook's own footage uses, rather
# than sharing ICEAGE_SRC with examples_ice's totally different parapet/
# rapids vantage -- r207's whole complaint was this SAME image being reused
# across two unrelated real backgrounds. examples_ice keeps ICEAGE_SRC
# unchanged: r209's own "examples" and "borrow/worn" generations were never
# delivered as usable standalone plates (only baked into a mockup collage
# with a fake AR-window graphic already burned in) and the "borrow" one
# used an unrelated woman, not the actual wearer -- both rejected, see
# r210's own report; a corrected re-request went out the same round.
HOOK_ICEAGE_SRC = os.path.join(_HERE, "..", "ai", "iceage", "iceage_hook_railing_r209_chatgpt.jpg")
DAK_SRC = os.path.join(_HERE, "..", "raw", "IMG_DAK1.MOV")


def _run_rawvideo(cmd, n, w=W, h=H):
    """Runs an ffmpeg command whose final two args are ["-f","rawvideo"]
    (this function appends the output path itself) and reads the result
    back from a plain temp FILE, not a live pipe. Measured 3-4x faster
    AND far more consistent than piping through subprocess on this
    machine (16.5s vs up to 60s for the identical 240-frame 1920x1080
    read) -- inter-process pipes appear to have unpredictable, sometimes
    very slow throughput in this sandboxed environment; a plain
    sequential file write/read does not."""
    import tempfile
    frame_size = w * h * 3
    with tempfile.NamedTemporaryFile(suffix=".raw", delete=False) as tf:
        tmp_path = tf.name
    os.remove(tmp_path)
    try:
        full_cmd = cmd + [tmp_path]
        r = subprocess.run(full_cmd, capture_output=True)
        got = os.path.getsize(tmp_path) // frame_size
        if got < n:
            raise SystemExit(f"_run_rawvideo: wanted {n} frames, got {got}: {r.stderr.decode()[-500:]}")
        a = np.fromfile(tmp_path, dtype=np.uint8, count=n * frame_size).reshape(n, h, w, 3)
        # uint8, NOT float32: converting a whole clip's worth of frames to
        # float32 upfront measured ~35s of genuine CPU-bound conversion
        # work for 240 1920x1080 frames on this machine (irrespective of
        # whether it's done per-frame or as one vectorized call -- the
        # data volume is what costs, ~6GB out for ~1.5GB in). That's easily
        # the majority of a section composite's wall clock, on top of the
        # already-variable decode time, and was pushing hook's build past
        # the harness's kill threshold. Callers that need float math
        # (bright_edit_grade, windowed_reveal's actual blend) convert only
        # the single frame(s) they're touching, when they touch them --
        # most frames in most sections never need it at all (see
        # windowed_reveal's own progress<=0 shortcut, and its blend is
        # confined to the AR window's own small area besides)."""
        return [f.copy() for f in a]
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def read_clip(clip, tin, dur, fps=FPS, w=W, h=H):
    n = int(round(dur * fps))
    vf = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={fps}"
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{tin}", "-i", f"{RAW}/IMG_{clip}.MOV",
           "-frames:v", str(n), "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24"]
    return _run_rawvideo(cmd, n, w, h)


def read_plate(path, dur, fps=FPS, w=W, h=H):
    n = int(round(dur * fps))
    vf = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={fps}"
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-frames:v", str(n),
           "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24"]
    return _run_rawvideo(cmd, n, w, h)


def build_photo_zoom(src, dur, cap=1.05, fps=FPS):
    n = int(round(dur * fps))
    rate = (cap - 1.0) / (n * 0.5)
    sw, sh = int(W * 1.25), int(H * 1.25)
    vf = (f"scale={sw}:{sh}:flags=lanczos,"
          f"zoompan=z='min(1.0+{rate}*on,{cap})':d={n}:x='iw/2-(iw/zoom/2)':"
          f"y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={fps}")
    cmd = ["ffmpeg", "-v", "error", "-loop", "1", "-i", src, "-t", str(dur),
           "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24"]
    return _run_rawvideo(cmd, n, W, H)


def bright_edit_grade(bgr):
    """The bright, graphic, editorial daylight treatment r184 asks for --
    a slight lift, a touch more contrast and saturation than the source.
    The direct opposite instinct from map/'s dark_doc_grade, and a
    stronger push than walk/'s barely-graded natural_grade or field/'s
    desaturated paper grade."""
    x = bgr.astype(np.float32) / 255.0
    x = np.clip((x - 0.5) * 1.08 + 0.5 + 0.04, 0, 1)
    gray = x.mean(axis=2, keepdims=True)
    x = np.clip(gray + (x - gray) * 1.15, 0, 1)
    return x * 255.0


def from_pil(img):
    rgb = np.array(img.convert("RGB"))
    return rgb[:, :, ::-1].astype(np.float32)


def _zoom_frame(frame_bgr, scale):
    """Center-crop push-in on an already-loaded real-footage frame --
    the same "gentle continuous push-in" language this file already
    uses for the AI plates, applied to loop_world so it isn't the one
    section in the film with zero camera motion for a full 12 seconds
    (every other full-bleed section's own footage carries some camera
    movement; this clip is close to locked-off). scale<=1.0 is a no-op."""
    if scale <= 1.0001:
        return frame_bgr
    h, w = frame_bgr.shape[:2]
    img = Image.fromarray(np.clip(frame_bgr, 0, 255).astype(np.uint8)[:, :, ::-1])
    nw, nh = int(round(w * scale)), int(round(h * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - w) // 2, (nh - h) // 2
    img = img.crop((left, top, left + w, top + h))
    return np.array(img)[:, :, ::-1]


def encode(frames, dst, fps=FPS, crf=15, preset="slow"):
    """Writes frames to a plain temp file first, then points ffmpeg's
    rawvideo demuxer at that file -- not a live stdin pipe. Same fix as
    _run_rawvideo's own docstring: this environment's inter-process pipes
    measured unpredictably slow (up to 60s for data a plain file write/
    read handled in ~16s); a stdin pipe write is exactly as exposed to
    that as the stdout pipe read was."""
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".raw", delete=False) as tf:
        tmp_path = tf.name
        for f in frames:
            tf.write(np.clip(f, 0, 255).astype(np.uint8).tobytes())
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
             "-s", f"{W}x{H}", "-r", str(fps), "-i", tmp_path, "-an",
             "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p", dst],
            check=True)
    finally:
        os.remove(tmp_path)


# ---- phase 1: SOURCES -- one heavy raw-footage/plate read each, cached
# to a small graded intermediate clip. Each is its own CLI target so it
# runs as its own short-lived process. -------------------------------

# Three sources need 12.0s of raw footage -- measured to reliably get
# SIGKILLed as a single read on this machine (every read <=9.5s
# succeeded; every 12.0s read was killed, mid-run, with no error text at
# all -- a real external wall-clock limit, not a bug in the read itself).
# Each is split into two 6.0s halves, each its own tiny process, then
# concatenated (a cheap `-c copy` mux, not a re-encode) into the single
# _src_<key>.mp4 the section builders expect.
# r199: recognize_world and loop_world now read IMG_6794 (the wearer's
# continuous overlook take) at the in-points that keep the whole
# recognize->examples->loop stretch one unbroken 41.5s span of it (see
# this file's own module docstring for the full budget).
SPLIT_PARTS = {
    "borrow_world": [("6790", 16.0, 6.0), ("6790", 22.0, 6.0)],
    "recognize_world": [("6794", 0.0, 6.0), ("6794", 6.0, 6.0)],
    "loop_world": [("6794", 29.5, 6.0), ("6794", 35.5, 6.0)],
}

SOURCE_DUR = {
    "hook_world": 8.0, "hook_layer": 8.0,
    "borrow_world": 12.0, "borrow_hero": 5.5, "borrow_worn": 5.0,
    "recognize_world": 12.0,
    # IMG_DAK1.MOV is exactly 8.0s -- exhist's own duration matches the
    # real plate length exactly rather than requesting more than exists.
    # exice absorbs the other 0.5s so examples' total stays 22.0s.
    "exhist_world": 8.0, "exhist_layer": 8.0,
    "exice_world": 9.5, "exice_layer": 9.5,
    "loop_world": 12.0,
    "close_world": 8.0,
}
for _key, _parts in SPLIT_PARTS.items():
    for _i, (_clip, _tin, _dur) in enumerate(_parts):
        SOURCE_DUR[f"{_key}_p{_i}"] = _dur

SOURCE_READERS = {
    # r203: shifted from @8.0s (where he has already turned his back and
    # is walking away -- the exact orientation the operator's own r201
    # screenshot showed) to @0.5s. This is the ONE stretch found across
    # a full audit of all 33 real candid clips where he faces camera and
    # extends his arm in a clear pointing gesture (raw t~3.5-7.0s, real
    # signage as the target) -- see r203's own gaze-alignment audit.
    # 0.5s (not 0.0s) skips a finger-over-lens artifact in the first
    # ~0.4s of the raw clip.
    "hook_world": lambda: read_clip("6790", 0.5, 8.0),
    "hook_layer": lambda: build_photo_zoom(HOOK_ICEAGE_SRC, 8.0, cap=1.06),
    "borrow_hero": lambda: build_photo_zoom(HERO_SRC, 5.5, cap=1.05),
    "borrow_worn": lambda: build_photo_zoom(WORN_SRC, 5.0, cap=1.05),
    # r199: 12.0-20.0s and 20.0-29.5s of IMG_6794 -- continuing directly
    # from recognize_world's own 0.0-12.0s on the same unbroken take.
    "exhist_world": lambda: read_clip("6794", 12.0, 8.0),
    "exhist_layer": lambda: read_plate(DAK_SRC, 8.0),
    "exice_world": lambda: read_clip("6794", 20.0, 9.5),
    "exice_layer": lambda: build_photo_zoom(ICEAGE_SRC, 9.5, cap=1.05),
    "close_world": lambda: read_clip("6790", 22.0, 8.0),
}
for _key, _parts in SPLIT_PARTS.items():
    for _i, (_clip, _tin, _dur) in enumerate(_parts):
        SOURCE_READERS[f"{_key}_p{_i}"] = (lambda clip=_clip, tin=_tin, dur=_dur: read_clip(clip, tin, dur))

SECTION_SOURCES = {
    "hook": ["hook_world", "hook_layer"],
    "borrow": ["borrow_world", "borrow_hero", "borrow_worn"],
    "recognize": ["recognize_world"],
    "examples_hist": ["exhist_world", "exhist_layer"],
    "examples_ice": ["exice_world", "exice_layer"],
    "examples_audio": [],
    "loop": ["loop_world"],
    "close": ["close_world"],
}


def render_source(key):
    frames = [bright_edit_grade(f) for f in SOURCE_READERS[key]()]
    encode(frames, f"{OUT}/_src_{key}.mp4", crf=12, preset="fast")
    print(f"  source {key} cached ({len(frames)} frames)")


def concat_split_source(key):
    parts = SPLIT_PARTS[key]
    part_paths = [f"{OUT}/_src_{key}_p{i}.mp4" for i in range(len(parts))]
    missing = [p for p in part_paths if not os.path.exists(p)]
    if missing:
        raise SystemExit(f"concat_split_source({key}): missing {missing}, render those parts first")
    list_path = f"{OUT}/_concat_{key}.txt"
    with open(list_path, "w") as fh:
        for p in part_paths:
            fh.write(f"file '{os.path.abspath(p)}'\n")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", list_path, "-c", "copy", f"{OUT}/_src_{key}.mp4"], check=True)
    print(f"  source {key} concatenated from {len(parts)} parts")


def load_source(key):
    n = int(round(SOURCE_DUR[key] * FPS))
    path = f"{OUT}/_src_{key}.mp4"
    if not os.path.exists(path):
        raise SystemExit(f"missing source {path} -- run `python3 render_layer.py {key}` first")
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-frames:v", str(n),
           "-f", "rawvideo", "-pix_fmt", "bgr24"]
    return _run_rawvideo(cmd, n, W, H)


# ---- phase 2: SECTIONS -- pure compositing over already-cached, already
# -graded source clips; no raw footage read happens here. -------------

def build_hook():
    dur = 8.0
    n = int(round(dur * FPS))
    world = load_source("hook_world")
    layer = load_source("hook_layer")
    out = []
    for i in range(n):
        t = i / FPS
        if t < 1.8:
            progress = 0.0
        elif t < 4.2:
            progress = G.ease((t - 1.8) / 2.4)
        else:
            progress = 1.0
        # r203: window repositioned to sit where he actually points
        # (raw IMG_6790 t~3.5-7.0s, local t~3.0-6.5s here -- right as
        # the reveal opens/holds) -- x=1000/1920, y=470/1080, same w/h
        # as the shared default. Every other windowed_reveal call in
        # the film keeps the shared WIN_CX/CY_FRAC position; this is
        # the one shot with a real gesture to align to.
        img = G.windowed_reveal(world[i], layer[i], progress, direction="ltr",
                                 win_cx=1000 / 1920, win_cy=470 / 1080)
        if t <= 1.9:
            k = G.fade_k(t, 1.9, in_t=0.4, out_margin=0.5)
            G.primary_label(img, "THE WORLD", k=k, y_frac=0.14)
        else:
            k = G.fade_k(t - 1.9, dur - 1.9, in_t=0.4, out_margin=0.4)
            G.primary_label(img, "THE LAYER", k=k, y_frac=0.14)
        if progress > 0.001:
            G.disclosure(img, "VISUALIZATION", corner="tr")
        out.append(from_pil(img))
    return out


def build_borrow():
    dur = 12.0
    n = int(round(dur * FPS))
    world = load_source("borrow_world")
    hero = load_source("borrow_hero")
    worn = load_source("borrow_worn")
    out = []
    for i in range(n):
        t = i / FPS
        if t < 7.0:
            layer = hero[min(int(round(max(0.0, t - 1.5) * FPS)), len(hero) - 1)]
        else:
            layer = worn[min(int(round((t - 7.0) * FPS)), len(worn) - 1)]
        if t < 1.5:
            progress = 0.0
        elif t < 3.0:
            progress = G.ease((t - 1.5) / 1.5)
        elif t < 11.0:
            progress = 1.0
        else:
            progress = G.ease(1.0 - (t - 11.0) / 1.0)
        # r201: shrink_brackets=True only during THIS section's own
        # closing sweep (t>=11.0) -- the one call site in the whole
        # film that actually closes back to 0 -- so the bracket
        # rectangle tracks the shrinking revealed content instead of
        # staying full-size around empty space. Every other
        # windowed_reveal call (this section's own opening included) is
        # unaffected.
        img = G.windowed_reveal(world[i], layer, progress, direction="ttb",
                                 shrink_brackets=(t >= 11.0))
        if t < 1.6:
            k = G.fade_k(t, 1.6, in_t=0.3, out_margin=0.4)
            G.primary_label(img, "BORROW THE LAYER", k=k, y_frac=0.14, accent_bg=False)
        if 1.5 <= t < 7.0:
            if progress > 0.001:
                G.disclosure(img, "PRODUCT VISUALIZATION", corner="tr")
            if t >= 2.6:
                G.primary_label(img, "HARDWARE", k=G.fade_k(t - 2.6, 7.0 - 2.6, in_t=0.3, out_margin=0.3),
                                 y_frac=0.14, font_size=76, accent_bg=False)
            if t >= 3.2:
                G.caption(img, t - 3.2, 7.0 - 3.2, CAPTIONS["hardware"])
        elif t >= 7.0:
            if progress > 0.001:
                G.disclosure(img, "PRODUCT VISUALIZATION", corner="tr")
            if t < 11.4:
                G.primary_label(img, "SOFTWARE", k=G.fade_k(t - 7.0, 11.4 - 7.0, in_t=0.3, out_margin=0.3),
                                 y_frac=0.14, font_size=76, accent_bg=False)
            if t < 11.0:
                G.caption(img, t - 7.0, 11.0 - 7.0, CAPTIONS["software"])
        out.append(from_pil(img))
    return out


ZONE_CX, ZONE_CY, ZONE_W, ZONE_H = 560, 460, 760, 400
ANCHOR_X, ANCHOR_Y = 560, 460


def build_recognize():
    dur = 12.0
    n = int(round(dur * FPS))
    world = load_source("recognize_world")
    out = []
    for i in range(n):
        t = i / FPS
        img = G.full_bleed(world[i])
        if t <= 1.9:
            k = G.fade_k(t, 1.9, in_t=0.4, out_margin=0.5)
            G.primary_label(img, "WHEN THE PLACE RECOGNIZES YOU", k=k, y_frac=0.12, font_size=72, accent_bg=False)
        if t >= 1.8:
            k = G.fade_k(t - 1.8, dur - 1.8, in_t=0.5, out_margin=0.0, no_out=True)
            G.zone_trace(img, ZONE_CX, ZONE_CY, ZONE_W, ZONE_H, k=k)
        if t >= 3.0:
            k = G.fade_k(t - 3.0, dur - 3.0, in_t=0.5, out_margin=0.0, no_out=True)
            phase = (t % 1.6) / 1.6
            G.anchor_pulse(img, ANCHOR_X, ANCHOR_Y, k=k, phase=phase)
        if 3.2 <= t < 7.2:
            G.caption(img, t - 3.2, 4.0, CAPTIONS["recognize_1"])
        elif 7.2 <= t < 11.6:
            G.caption(img, t - 7.2, 4.4, CAPTIONS["recognize_2"])
        out.append(from_pil(img))
    return out


def build_examples_hist():
    seg_dur = 8.0
    n = int(round(seg_dur * FPS))
    world = load_source("exhist_world")
    layer = load_source("exhist_layer")
    out = []
    for i in range(n):
        t = i / FPS
        if t < 1.0:
            progress = 0.0
        elif t < 2.2:
            progress = G.ease((t - 1.0) / 1.2)
        else:
            progress = 1.0
        img = G.windowed_reveal(world[i], layer[i], progress, direction="ltr")
        if progress > 0.001:
            G.disclosure(img, "VISUALIZATION", corner="tr")
        if t >= 2.2:
            G.caption(img, t - 2.2, seg_dur - 2.2, CAPTIONS["historical"])
        out.append(from_pil(img))
    return out


def build_examples_ice():
    seg_dur = 9.5
    n = int(round(seg_dur * FPS))
    world = load_source("exice_world")
    layer = load_source("exice_layer")
    out = []
    for i in range(n):
        t = i / FPS
        if t < 1.0:
            progress = 0.0
        elif t < 2.4:
            progress = G.ease((t - 1.0) / 1.4)
        else:
            progress = 1.0
        img = G.windowed_reveal(world[i], layer[i], progress, direction="diag")
        if progress > 0.001:
            G.disclosure(img, "VISUALIZATION", corner="tr")
        if t >= 2.4:
            G.caption(img, t - 2.4, seg_dur - 2.4, CAPTIONS["iceage"])
        out.append(from_pil(img))
    return out


def build_examples_audio():
    seg_dur = 4.5
    n = int(round(seg_dur * FPS))
    # r199: the still is grabbed at IMG_6794 @29.5s -- the exact instant
    # examples_ice's own read ends, so the wearer's continuous take
    # carries straight through into this reset with no time jump.
    still = bright_edit_grade(read_clip("6794", 29.5, 0.1)[0])
    out = []
    for i in range(n):
        t = i / FPS
        # r208: this was a single frame held completely static for all
        # 4.5s -- the one section in the film with LESS motion than
        # loop had before r193's fix (loop was at least real footage;
        # this was one frame from the start). Same gentle continuous
        # push-in r193 already established for loop, scaled to this
        # section's own duration.
        frame = _zoom_frame(still, 1.0 + 0.07 * (t / seg_dur))
        img = G.full_bleed(frame)
        if t >= 1.0:
            k = G.fade_k(t - 1.0, seg_dur - 1.0, in_t=0.4, out_margin=0.0, no_out=True)
            phase = ((t - 1.0) % 1.2) / 1.2
            # r199: shifted left off center (was W*0.5) -- the wearer
            # occupies right-of-center in this shot; the anchor now
            # sits over open falls/sky, matching the AR window's own
            # position, instead of grazing his head/shoulder.
            G.anchor_pulse(img, W * 0.34, H * 0.34, k=k, phase=phase)
            G.anchor_pulse(img, W * 0.34, H * 0.34, k=k, phase=(phase + 0.5) % 1.0)
        if t >= 1.2:
            G.caption(img, t - 1.2, seg_dur - 1.2, CAPTIONS["audio"])
        out.append(from_pil(img))
    return out


def build_loop():
    dur = 12.0
    n = int(round(dur * FPS))
    world = load_source("loop_world")
    out = []
    for i in range(n):
        t = i / FPS
        frame = _zoom_frame(world[i], 1.0 + 0.07 * (t / dur))
        img = G.full_bleed(frame)
        idx = min(int(t // 3.0), len(LOOP_WORDS) - 1)
        local_t = t - idx * 3.0
        primary, sub = LOOP_WORDS[idx]
        k = G.fade_k(local_t, 3.0, in_t=0.3, out_margin=0.3)
        G.loop_word(img, primary, sub, k=k)
        out.append(from_pil(img))
    return out


def build_close():
    dur = 8.0
    end_dur = 3.5
    n = int(round(dur * FPS))
    world = load_source("close_world")
    out = []
    for i in range(n):
        t = i / FPS
        img = G.full_bleed(world[i])
        if t < dur - end_dur:
            G.caption(img, t, dur - end_dur, CAPTIONS["close"], y_frac=0.85)
        if t >= dur - end_dur:
            G.end_card(img, t - (dur - end_dur), end_dur,
                       "OPEN RANGE INTERACTIVE",
                       "PLACE-BASED STORIES, LAYERED ONTO REAL PLACES")
        out.append(from_pil(img))
    return out


BUILDERS = {
    "hook": build_hook, "borrow": build_borrow, "recognize": build_recognize,
    "loop": build_loop, "close": build_close,
    "examples_hist": build_examples_hist, "examples_ice": build_examples_ice,
    "examples_audio": build_examples_audio,
}

EXAMPLES_PARTS = ["examples_hist", "examples_ice", "examples_audio"]
SECTION_TARGETS = set(BUILDERS.keys())
SECTION_DUR = {s: d for s, st, d, desc in SECTIONS if s != "examples"}
SECTION_DUR.update({"examples_hist": 8.0, "examples_ice": 9.5, "examples_audio": 4.5})


def concat_examples_parts():
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


def main(targets):
    os.makedirs(OUT, exist_ok=True)
    if not targets:
        raise SystemExit(
            "usage: python3 render_layer.py <target> [target ...]\n"
            f"  source targets: {sorted(SOURCE_READERS)}\n"
            f"  split-source concat targets: {sorted(SPLIT_PARTS)}\n"
            f"  section targets: {sorted(SECTION_TARGETS)}\n"
            "  special: examples_concat (concat the 3 examples parts)")
    for name in targets:
        if name in SOURCE_READERS:
            render_source(name)
        elif name in SPLIT_PARTS:
            concat_split_source(name)
        elif name in SECTION_TARGETS:
            dur = SECTION_DUR[name]
            frames = BUILDERS[name]()
            assert len(frames) == int(round(dur * FPS)), \
                f"{name}: built {len(frames)} frames, expected {int(round(dur*FPS))}"
            encode(frames, f"{OUT}/{name}_t.mp4")
            print(f"  {name} composed ({len(frames)} frames)")
        elif name == "examples_concat":
            concat_examples_parts()
        else:
            raise SystemExit(f"unknown target: {name}")


if __name__ == "__main__":
    main(sys.argv[1:])
