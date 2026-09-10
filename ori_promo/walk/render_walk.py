#!/usr/bin/env python3
"""v35 "THE WALKTHROUGH" -- render engine. Run from this directory:

    python3 render_walk.py

A third, independent engine -- not a copy of one/render_one.py (AR-anchor
tracking, figure compositing, ice-grade masking) or field/render_field.py
(paper-panel card system, step strip, split screen). What's shared across
all three is only the genuinely generic layer: reading raw footage,
encoding H.264. Everything else -- the natural-light grade, the minimal
white-text graphics -- is graphics_walk.py's own, built for r174's brief.
"""
import os
import subprocess

import numpy as np
from PIL import Image

import graphics_walk as G
from spec_walk import W, H, FPS, TOTAL, BEATS, RAW, PROGRESS_START, PROGRESS_END

OUT = "out_walk"
_HERE = os.path.dirname(os.path.abspath(__file__))
_BEAT_START = {b: st for b, st, d, desc in BEATS}


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
    """A still photo (hero detail, worn plate) re-encoded with a
    restrained push-in -- same zoompan technique field/render_field.py
    uses for build_worn_long, generalized so this kit can reuse it for
    ANY still without copy-pasting the ffmpeg graph per-asset."""
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


def natural_grade(bgr):
    """Even lighter than field/render_field.py's daylight_grade -- r174's
    brief wants "natural, immediate, human scale", not a graded look at
    all. A hair of contrast only, so real footage still reads as real
    footage, not a corrected version of it."""
    x = bgr.astype(np.float32) / 255.0
    x = np.clip((x - 0.5) * 1.03 + 0.5, 0, 1)
    return x * 255.0


def to_pil_rgba(bgr_float):
    rgb = np.clip(bgr_float, 0, 255).astype(np.uint8)[:, :, ::-1]
    return Image.fromarray(rgb).convert("RGBA")


def from_pil(img):
    rgb = np.array(img.convert("RGB"))
    return rgb[:, :, ::-1].astype(np.float32)


def solid_bg(color=(20, 20, 20)):
    bgr = np.zeros((H, W, 3), np.float32)
    bgr[:, :, 0], bgr[:, :, 1], bgr[:, :, 2] = color[2], color[1], color[0]
    return bgr


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


def _progress_frac(global_t):
    return (global_t - PROGRESS_START) / (PROGRESS_END - PROGRESS_START)


def build_arrive():
    dur = 7.0
    # in-point 0.6s, not 0.0s: the clip's literal first ~0.6s has a
    # finger/thumb passing in front of the lens (someone's hand near the
    # camera as recording started) -- checked frame-by-frame, confirmed
    # clear by t=0.6s.
    frames = read_clip("6790", 0.6, dur)
    out = []
    for i, f in enumerate(frames):
        t = i / FPS
        img = to_pil_rgba(natural_grade(f))
        if t < 3.0:
            G.chapter_word(img, t, 3.0, "ARRIVE")
        else:
            G.modest_title(img, t - 3.0, dur - 3.0, "OPEN RANGE INTERACTIVE")
        out.append(from_pil(img))
    return out


def build_borrow():
    hero_dur, worn_dur = 3.5, 5.5
    hero_src = os.path.join(_HERE, "..", "ai", "hero", "glasses_hero_chatgpt.jpg")
    worn_src = os.path.join(_HERE, "..", "ai", "worn", "product_worn_falls_park_plate_chatgpt.jpg")
    hero_frames = build_photo_zoom(hero_src, hero_dur, cap=1.05)
    worn_frames = build_photo_zoom(worn_src, worn_dur, cap=1.06)
    out = []
    for i, f in enumerate(hero_frames):
        t = i / FPS
        img = to_pil_rgba(natural_grade(f))
        G.disclosure(img, t, hero_dur, "PRODUCT VISUALIZATION", corner="tr")
        G.caption(img, t, hero_dur, "HARDWARE")
        out.append(from_pil(img))
    for i, f in enumerate(worn_frames):
        t = i / FPS
        img = to_pil_rgba(natural_grade(f))
        G.disclosure(img, t, worn_dur, "PRODUCT VISUALIZATION", corner="tr")
        G.caption(img, t, worn_dur, "SOFTWARE")
        out.append(from_pil(img))
    return out


def build_walk():
    dur = 10.0
    frames = read_clip("6805", 38.0, dur)
    out = []
    beat_start = _BEAT_START["walk"]
    for i, f in enumerate(frames):
        t = i / FPS
        img = to_pil_rgba(natural_grade(f))
        if t < 3.0:
            G.chapter_word(img, t, 3.0, "WALK")
        G.progress_line(img, _progress_frac(beat_start + t))
        out.append(from_pil(img))
    return out


def build_recognize():
    dur = 12.0
    # in-point 45.0s, not 18.0s: a bystander (woman with a backpack) is
    # actually in frame continuously through roughly 0-27s of this clip --
    # a coarser 3s-interval scout earlier misjudged 18-30s as clean.
    # Re-scouted at 1s intervals across the FULL clip: verified clean from
    # ~30s onward. 45.0-57.0s is within that confirmed-clean stretch and
    # does not overlap v34's own 33.0-45.0s window.
    frames = read_clip("6806", 45.0, dur)
    out = []
    beat_start = _BEAT_START["recognize"]
    for i, f in enumerate(frames):
        t = i / FPS
        img = to_pil_rgba(natural_grade(f))
        if t < dur / 2:
            G.caption(img, t, dur / 2, "RECOGNIZES THE EXPERIENCE ZONE")
        else:
            G.caption(img, t - dur / 2, dur / 2, "ANCHORS CONTENT TO THIS PLACE")
        G.progress_line(img, _progress_frac(beat_start + t))
        out.append(from_pil(img))
    return out


def _bridge(clip, tin, dur, beat_start, t0):
    """r177 fix (per r176's review): a short, plain real-footage cut
    between EXPERIENCE examples -- "no new claim or large overlay", just
    the route continuing. No caption, no disclosure tag (nothing
    generated is on screen), progress line only."""
    frames = read_clip(clip, tin, dur)
    out = []
    for i, f in enumerate(frames):
        t = i / FPS
        img = to_pil_rgba(natural_grade(f))
        G.progress_line(img, _progress_frac(beat_start + t0 + t))
        out.append(from_pil(img))
    return out


def build_experience():
    # r177 fix: r176 rejected the three equal 5.33s holds as a "slideshow
    # rhythm" -- r174's own brief already said "avoid three equal
    # slideshow holds", missed on the first pass. Replaced with the exact
    # unequal, movement-led timing r176 specified: 4.2 + 0.5(bridge) + 5.5
    # + 0.5(bridge) + 5.3 = 16.0s, same total, same three examples, same
    # captions/disclosures -- only the internal rhythm changes.
    out = []
    beat_start = _BEAT_START["experience"]
    t0 = 0.0

    # a) historical reconstruction -- dak plate, already-disclosed asset
    seg = 4.2
    dak_frames = read_plate(os.path.join(RAW, "IMG_DAK1.MOV"), seg)
    for i, f in enumerate(dak_frames):
        t = i / FPS
        img = to_pil_rgba(natural_grade(f))
        G.disclosure(img, t, seg, "VISUALIZATION", corner="tr")
        G.caption(img, t, seg, "HISTORICAL RECONSTRUCTION")
        G.progress_line(img, _progress_frac(beat_start + t0 + t))
        out.append(from_pil(img))
    t0 += seg

    # bridge 1 -- real location footage: 60.0s was tried first and
    # rejected on inspection (a bystander -- NOT our recurring visitor,
    # a different person -- walks through that window, visible at
    # full render resolution though not at the low-res thumbnail this
    # was first scouted at). Re-scouted 84-91.5s at full resolution:
    # confirmed genuinely empty of any person, real continuous water
    # motion -- a location bridge, the alternative r176's own wording
    # explicitly allows ("real walking/location bridge"). Distinct from
    # every other beat's use of this clip (walk: 38-48, return: 48-58,
    # close: 70-78, spatial-audio still: 80.0).
    out += _bridge("6805", 85.0, 0.5, beat_start, t0)
    t0 += 0.5

    # b) ice-age -- r172's supplied plate, explicitly named for reuse by
    # r174 itself. Restrained push-in, same cap as v34's own treatment.
    seg = 5.5
    iceage_src = os.path.join(_HERE, "..", "ai", "iceage", "iceage_falls_visualization_r172_chatgpt.jpg")
    ice_frames = build_photo_zoom(iceage_src, seg, cap=1.03)
    for i, f in enumerate(ice_frames):
        t = i / FPS
        img = to_pil_rgba(natural_grade(f))
        G.disclosure(img, t, seg, "VISUALIZATION", corner="tr")
        G.caption(img, t, seg, "ICE AGE VISUALIZATION")
        G.progress_line(img, _progress_frac(beat_start + t0 + t))
        out.append(from_pil(img))
    t0 += seg

    # bridge 2 -- second in-point, same clean stretch, same reasoning
    out += _bridge("6805", 89.0, 0.5, beat_start, t0)
    t0 += 0.5

    # c) spatial audio -- a diagram, not a photo; real (dimmed) footage,
    # no disclosure tag needed (same reasoning as field/render_field.py's
    # own spatial-audio segment: a drawn diagram over real footage is not
    # fabricated imagery standing in for something real)
    seg = 5.3
    still = read_clip("6805", 80.0, 0.1)[0]
    still = natural_grade(still) * 0.6 + solid_bg((28, 26, 24)) * 0.4
    n = int(round(seg * FPS))
    for i in range(n):
        t = i / FPS
        img = to_pil_rgba(still)
        G.sync_glyph(img, t, seg, int(W * 0.38), int(H * 0.42), int(W * 0.62), int(H * 0.5))
        G.caption(img, t, seg, "SPATIAL AUDIO, SYNCHRONIZED")
        G.progress_line(img, _progress_frac(beat_start + t0 + t))
        out.append(from_pil(img))

    return out


def build_return():
    dur = 10.0
    frames = read_clip("6805", 48.0, dur)
    out = []
    beat_start = _BEAT_START["return"]
    CARDS = [(0.0, 3.3, "SITE-BASED EXPERIENCE"), (3.3, 6.6, "REUSABLE HARDWARE"),
             (6.6, 10.0, "UPDATEABLE SOFTWARE")]
    for i, f in enumerate(frames):
        t = i / FPS
        img = to_pil_rgba(natural_grade(f))
        if t < 3.0:
            G.chapter_word(img, t, 3.0, "RETURN")
        for c0, c1, text in CARDS:
            if c0 <= t < c1:
                G.caption(img, t - c0, c1 - c0, text)
        G.progress_line(img, _progress_frac(beat_start + t))
        out.append(from_pil(img))
    return out


def build_close():
    dur = 8.0
    end_dur = 3.0
    frames = read_clip("6805", 70.0, dur)
    out = []
    for i, f in enumerate(frames):
        t = i / FPS
        img = to_pil_rgba(natural_grade(f))
        if t >= dur - end_dur:
            G.end_card(img, t - (dur - end_dur), end_dur,
                       "OPEN RANGE INTERACTIVE",
                       "PLACE-BASED STORIES, EXPERIENCED WHERE THEY BELONG")
        out.append(from_pil(img))
    return out


BUILDERS = {
    "arrive": build_arrive, "borrow": build_borrow, "walk": build_walk,
    "recognize": build_recognize, "experience": build_experience,
    "return": build_return, "close": build_close,
}


def main(only=None):
    os.makedirs(OUT, exist_ok=True)
    for name, start, dur, desc in BEATS:
        if only and name not in only:
            continue
        frames = BUILDERS[name]()
        assert len(frames) == int(round(dur * FPS)), \
            f"{name}: built {len(frames)} frames, expected {int(round(dur*FPS))}"
        encode(frames, f"{OUT}/{name}_t.mp4")
        print(f"  {name} composed ({len(frames)} frames)")


if __name__ == "__main__":
    import sys
    main(sys.argv[1:] or None)
