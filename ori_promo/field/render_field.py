#!/usr/bin/env python3
"""v34 "THE FIELD GUIDE" -- render engine. Run from this directory:

    python3 render_field.py

Deliberately a SIMPLER engine than one/render_one.py, not a copy of it.
v33's engine carries machinery this style does not need: AR anchor
tracking (labels that follow camera motion -- this style's captions are
fixed-position printed cards, not tracked HUD), figure compositing,
ice-grade masking, per-beat jitter. None of that applies to a diagram-
led field guide. What's shared is only the genuinely generic layer:
reading raw footage, encoding H.264, and this project's own storage/
disclosure rules -- everything ELSE here (the daylight grade, the card
system) is field/graphics.py's own, built for this brief specifically.
"""
import os
import subprocess

import numpy as np
import cv2
from PIL import Image

import graphics as G
from spec_field import W, H, FPS, TOTAL, BEATS, RAW

OUT = "out_field"
_HERE = os.path.dirname(os.path.abspath(__file__))


def read_clip(clip, tin, dur, fps=FPS, w=W, h=H):
    """Real footage -> exactly n=dur*fps frames, scaled/cropped to WxH
    (center-crop to 16:9 if the source isn't already, no letterbox --
    this style is full-bleed 16:9, not 2.39 scope)."""
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
    """A pre-built generated-plate MOV (dak, worn) -- same read path as
    real footage; these are already full videos, not stills."""
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


def build_worn_long(dur, fps=FPS):
    """v33's IMG_WORN1.MOV is 1.5s, sized for its own beat. Same source
    photo (ai/worn/product_worn_falls_park_plate_chatgpt.jpg, not
    regenerated), re-encoded at THIS beat's own duration -- the same
    reuse pattern this whole project already uses for every generated
    plate that appears in more than one place."""
    src = os.path.join(_HERE, "..", "ai", "worn", "product_worn_falls_park_plate_chatgpt.jpg")
    n = int(round(dur * fps))
    cap = 1.06
    rate = (cap - 1.0) / (n * 0.5)
    vf = (f"scale=2688:1512:flags=lanczos,"
          f"zoompan=z='min(1.0+{rate}*on,{cap})':d={n}:x='iw/2-(iw/zoom/2)':"
          f"y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={fps}")
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-loop", "1", "-i", src, "-t", str(dur),
         "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True)
    b = r.stdout
    got = len(b) // (W * H * 3)
    if got < n:
        raise SystemExit(f"worn_long: wanted {n}, got {got}: {r.stderr.decode()[-500:]}")
    a = np.frombuffer(b[:n * W * H * 3], np.uint8).reshape(n, H, W, 3)
    return [f.copy() for f in a]


def daylight_grade(bgr):
    """A light lift, not v33's filmic S-curve. r168: 'daylight palette'
    -- the whole point is this should NOT look cinematically graded, it
    should look like clean, honest daylight video, the way an actual
    museum-produced field guide looks. Mild contrast + clarity only."""
    x = bgr.astype(np.float32) / 255.0
    x = np.clip((x - 0.5) * 1.06 + 0.5, 0, 1)
    x = np.clip(x * 1.03, 0, 1)
    return (x * 255.0)


def to_pil_rgba(bgr_float):
    rgb = np.clip(bgr_float, 0, 255).astype(np.uint8)[:, :, ::-1]
    return Image.fromarray(rgb).convert("RGBA")


def from_pil(img):
    rgb = np.array(img.convert("RGB"))
    return rgb[:, :, ::-1].astype(np.float32)


def solid_bg(color=(250, 246, 236)):
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


def build_open():
    dur = 6.0
    frames = read_clip("6799", 1.0, dur)
    out = []
    n = len(frames)
    for i, f in enumerate(frames):
        t = i / FPS
        plate = daylight_grade(f)
        img = to_pil_rgba(plate)
        G.title_card(img, t, dur, "A FIELD GUIDE TO", "OPEN RANGE INTERACTIVE")
        out.append(from_pil(img))
    return out


def build_system():
    dur = 9.0
    n = int(dur * FPS)
    left_src = np.array(Image.open(os.path.join(_HERE, "..", "ai", "hero", "glasses_hero_chatgpt.jpg"))
                         .convert("RGB").resize((W, H)))[:, :, ::-1].astype(np.uint8)
    right_frames = read_clip("6790", 5.0, dur)
    out = []
    for i in range(n):
        t = i / FPS
        right = daylight_grade(right_frames[i]).astype(np.uint8)
        left = left_src.astype(np.uint8)
        composite = G.split_screen(left, right, t, dur, "hardware", "software")
        img = to_pil_rgba(composite.astype(np.float32))
        G.disclosure_tag(img, t, dur, "PRODUCT VISUALIZATION", corner="tl")
        out.append(from_pil(img))
    return out


def build_borrow():
    dur = 8.0
    walk_dur, worn_dur = 5.0, 3.0
    walk_frames = read_clip("6790", 14.0, walk_dur)
    worn_frames = build_worn_long(worn_dur)
    out = []
    n = int(dur * FPS)
    for i in range(n):
        t = i / FPS
        if t < walk_dur:
            plate = daylight_grade(walk_frames[i])
            active = 0 if t < walk_dur * 0.4 else 1
        else:
            j = min(len(worn_frames) - 1, int((t - walk_dur) * FPS))
            plate = daylight_grade(worn_frames[j])
            active = 1  # still explore -- no return footage exists in this
            # beat, and highlighting RETURN over a shot of him wearing the
            # glasses would visually claim "wearing them" is what returning
            # looks like. RETURN is picked up in build_destination() instead,
            # where the narration ("the glasses are returned") actually matches.
        img = to_pil_rgba(plate)
        G.step_strip(img, t, dur, ["borrow", "explore", "return"], active)
        if t >= walk_dur:
            G.disclosure_tag(img, t - walk_dur, worn_dur, "PRODUCT VISUALIZATION", corner="tl")
        out.append(from_pil(img))
    return out


def build_recognize():
    dur = 12.0
    frames = read_clip("6806", 33.0, dur)
    out = []
    n = len(frames)
    for i, f in enumerate(frames):
        t = i / FPS
        plate = daylight_grade(f)
        img = to_pil_rgba(plate)
        G.map_zone_marker(img, t, dur, int(W * 0.42), int(H * 0.55))
        if t < dur / 2:
            G.lower_card(img, t, dur / 2, "system", "RECOGNIZES THE EXPERIENCE ZONE")
        else:
            G.lower_card(img, t - dur / 2, dur / 2, "system", "ANCHORS CONTENT TO PLACE")
        out.append(from_pil(img))
    return out


def build_experience():
    seg = 14.0 / 3
    out = []

    # a) historical reconstruction -- dak plate, already-disclosed asset
    dak_frames = read_plate(os.path.join(RAW, "IMG_DAK1.MOV"), seg)
    for i, f in enumerate(dak_frames):
        t = i / FPS
        plate = daylight_grade(f)
        img = to_pil_rgba(plate)
        G.disclosure_tag(img, t, seg, "VISUALIZATION", corner="tl")
        G.lower_card(img, t, seg, "example one", "HISTORICAL RECONSTRUCTION")
        out.append(from_pil(img))

    # b) ice-age -- HONEST GAP, no fabricated image (spec_field.py's own
    # header explains why ai/ice/'s old renders are not used here)
    n = int(seg * FPS)
    for i in range(n):
        t = i / FPS
        plate = solid_bg((238, 234, 224))
        img = to_pil_rgba(plate)
        d_font = G.font("Bold", 30)
        from PIL import ImageDraw
        d = ImageDraw.Draw(img)
        k = G.fade_k(t, seg)
        a = int(255 * k)
        d.text((W // 2, H // 2 - 30), "NEEDED_ICEAGE_FALLS_VISUALIZATION", font=d_font,
               fill=G.INK + (a,), anchor="mm")
        f2 = G.font("Medium", 22)
        d.text((W // 2, H // 2 + 20), "no photoreal, location-matched asset exists yet",
               font=f2, fill=G.DIM + (a,), anchor="mm")
        G.lower_card(img, t, seg, "example two", "ICE-AGE VISUALIZATION")
        out.append(from_pil(img))

    # c) spatial audio -- a diagram, not a photo
    still = read_clip("6799", 3.0, 0.1)[0]
    still = (daylight_grade(still) * 0.55 + solid_bg((238, 234, 224)) * 0.45)
    n = int(seg * FPS)
    for i in range(n):
        t = i / FPS
        img = to_pil_rgba(still)
        G.audio_sync_glyph(img, t, seg, int(W * 0.38), int(H * 0.42), int(W * 0.62), int(H * 0.5))
        G.lower_card(img, t, seg, "example three", "SPATIAL AUDIO, SYNCHRONIZED")
        out.append(from_pil(img))

    return out


def build_destination():
    dur = 11.0
    d1, d2 = 8.0, 3.0
    f1 = read_clip("6799", 0.0, d1)
    f2 = read_clip("6802", 0.0, d2)
    out = []
    strip_dur = 2.2
    for i, f in enumerate(f1):
        t = i / FPS
        img = to_pil_rgba(daylight_grade(f))
        if t < strip_dur:
            G.step_strip(img, t, strip_dur, ["borrow", "explore", "return"], 2)
        else:
            G.summary_card(img, t - strip_dur, dur - strip_dur,
                            ["site-based", "reusable hardware", "updateable software"])
        out.append(from_pil(img))
    for i, f in enumerate(f2):
        t = d1 + i / FPS
        img = to_pil_rgba(daylight_grade(f))
        G.summary_card(img, t, dur, ["site-based", "reusable hardware", "updateable software"])
        out.append(from_pil(img))
    return out


def build_close():
    dur = 10.0
    vid_dur = 6.0
    # in-point 19.0s: this take is a locked-off wide of the falls. The
    # 10.0s in-point (originally scouted) has a jogger + a man walking a
    # dog crossing the foreground -- held frozen under the brand card for
    # 4s, that reads as a random bystander/dog staring dead ahead. 19.0s
    # is the same static shot with the foreground clear (checked the full
    # 18-30s window frame-by-frame: only a small, distant figure near the
    # ruins wall, no one in the foreground grass).
    frames = read_clip("6805", 19.0, vid_dur)
    out = []
    for i, f in enumerate(frames):
        t = i / FPS
        img = to_pil_rgba(daylight_grade(f))
        out.append(from_pil(img))
    last = frames[-1]
    hold_n = int((dur - vid_dur) * FPS)
    for i in range(hold_n):
        t = vid_dur + i / FPS
        plate = daylight_grade(last)
        img = to_pil_rgba(plate)
        G.title_card(img, t - vid_dur, dur - vid_dur, "OPEN RANGE INTERACTIVE",
                      "PLACE-BASED STORIES, SEEN WHERE THEY BELONG.", k=1.0)
        out.append(from_pil(img))
    return out


BUILDERS = {
    "open": build_open, "system": build_system, "borrow": build_borrow,
    "recognize": build_recognize, "experience": build_experience,
    "destination": build_destination, "close": build_close,
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
