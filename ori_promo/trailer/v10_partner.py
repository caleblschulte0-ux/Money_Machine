#!/usr/bin/env python3
"""V4 of five — PARTNER / CITY CUT, ~121s, 16:9.

Built to ChatGPT's r11 timed script: civic register, place-first, no
investor language and no deployment claims. Real Falls Park footage is the
anchor; every reconstruction beat enters from a grounded real plate first.
Approved footage, approved transparent assets and drawn graphics only.
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter
import numpy as np

sys.path.insert(0, "trailer")
from ui_kit import font

FPS = 30
W, H = 1920, 1080
IN, OUT, CARD = "trailer/out7", "trailer/out10", "trailer/card10"
U5, U7 = "trailer/ui5", "trailer/ui7"
AU = "trailer/audio"
BASE = ("unsharp=5:5:-0.35:5:5:0,"
        "curves=m='0/0 0.08/0.055 0.5/0.49 0.86/0.82 1/0.94',"
        "eq=saturation=0.93:contrast=1.06:brightness=-0.01,"
        "colorbalance=rm=.04:gs=-.02,noise=alls=4:allf=t")


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1800:])
        sys.exit("FAILED: " + " ".join(map(str, cmd[:8])))


# on-screen text per beat, kept inside 10% title-safe margins
CARDS = {
    "c1": ["FALLS PARK — MORE THAN A VIEW"],
    "c2": ["THE PLACE IS REAL.  THE PAST IS HIDDEN."],
    "c3": ["LOCATION-AWARE EXPERIENCE ZONES", "NO PERMANENT INSTALLATION"],
    "c4": ["DAKOTA LIFE — IN PLACE"],
    "c5": ["THE QUEEN BEE MILL — RESTORED IN CONTEXT"],
    "c6": ["DEEP TIME — BENEATH THE PARK"],
    "c7": ["SELF-CONTAINED", "PLACE-AWARE"],
    "c8": ["A SHARED EXPERIENCE"],
    "c9": ["ONE ROUTE  •  MULTIPLE ERAS"],
    "c10": ["EXPAND THE STORY — PRESERVE THE PLACE"],
}


def cards():
    os.makedirs(CARD, exist_ok=True)
    for name, lines in CARDS.items():
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        grad = np.zeros((H, W, 4), np.uint8)
        yy = np.arange(H)[:, None]
        band = np.clip((yy - 700) / 260, 0, 1) * np.clip((1010 - yy) / 150, 0, 1)
        grad[..., 3] = (band * 150).astype(np.uint8)
        img.alpha_composite(Image.fromarray(grad))
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        f = font("semi", 52)
        y = 838 if len(lines) == 1 else 800
        for ln in lines:
            tw = d.textlength(ln, font=f)
            d.text(((W - tw) / 2, y), ln, font=f, fill=(255, 255, 255, 255))
            y += 68
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sh.paste(Image.new("RGBA", (W, H), (5, 8, 11, 255)), (0, 0),
                 lay.split()[3].point(lambda p: min(p, 200)))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)), (0, 3))
        img.alpha_composite(lay)
        img.save(f"{CARD}/{name}.png")
    # brand lockup
    img = Image.new("RGBA", (W, H), (7, 9, 12, 255))
    d = ImageDraw.Draw(img)
    for txt, fo, y, col in (("OPEN RANGE", font("semi", 116), 396, (255,)*3 + (255,)),
                            ("INTERACTIVE", font("semi", 116), 528, (255,)*3 + (255,)),
                            ("HISTORY, WHERE IT HAPPENED", font("med", 42), 700,
                             (222, 228, 234, 250)),
                            ("Falls Park Beta · Sioux Falls, SD", font("med", 30), 800,
                             (168, 176, 184, 240))):
        tw = d.textlength(txt, font=fo)
        d.text(((W - tw) / 2, y), txt, font=fo, fill=col)
    img.save(f"{CARD}/brand.png")
    print("cards built")


def raw(name, src, ss, dur, card=None, cin=1.0, zoom=1.035, crop=None,
        fade_in=0.0, fade_out=0.0):
    """A real-footage plate, optionally with a text card over it."""
    cmd = ["ffmpeg", "-v", "error", "-ss", str(ss), "-t", str(dur), "-i", src]
    if card:
        cmd += ["-loop", "1", "-t", str(dur), "-i", f"{CARD}/{card}.png"]
    pre = ""
    if crop:
        pre = "crop=%d:%d:%d:%d," % (crop[2]-crop[0], crop[3]-crop[1], crop[0], crop[1])
    n = int(dur * FPS)
    zp = (f",scale=2020:1136:flags=lanczos,zoompan=z='1+{zoom-1}*on/{n}'"
          f":x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=1920x1080:fps={FPS}")
    fc = (f"[0:v]{pre}scale=1920:1080:force_original_aspect_ratio=increase,"
          f"crop=1920:1080,fps={FPS},{BASE}{zp}[b]")
    cur = "b"
    if card:
        fc += (f";[1:v]format=rgba,fade=t=in:st={cin}:d=0.5:alpha=1,"
               f"fade=t=out:st={dur-0.7}:d=0.5:alpha=1[c];[b][c]overlay[o]")
        cur = "o"
    tail = ""
    if fade_in:
        tail += f",fade=t=in:st=0:d={fade_in}"
    if fade_out:
        tail += f",fade=t=out:st={dur-fade_out}:d={fade_out}"
    fc += f";[{cur}]null{tail},setsar=1,format=yuv420p[v]"
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", f"{OUT}/{name}.mp4", "-y"]
    run(cmd)
    print("plate", name)


def clip(name, src, ss, dur, card=None, cin=1.0, slow=1.0):
    """Re-use an approved rendered shot, optionally with a text card."""
    cmd = ["ffmpeg", "-v", "error", "-ss", str(ss), "-t", str(dur / slow),
           "-i", f"{src}"]
    if card:
        cmd += ["-loop", "1", "-t", str(dur), "-i", f"{CARD}/{card}.png"]
    pre = f"setpts={slow}*PTS," if slow != 1.0 else ""
    fc = f"[0:v]{pre}fps={FPS}[b]"
    cur = "b"
    if card:
        fc += (f";[1:v]format=rgba,fade=t=in:st={cin}:d=0.5:alpha=1,"
               f"fade=t=out:st={dur-0.7}:d=0.5:alpha=1[c];[b][c]overlay[o]")
        cur = "o"
    fc += f";[{cur}]setsar=1,format=yuv420p[v]"
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", f"{OUT}/{name}.mp4", "-y"]
    run(cmd)
    print("clip", name)


def build_video():
    os.makedirs(OUT, exist_ok=True)
    seq = []
    # 1 — 0:00-8.0  the park as it is
    raw("a01", "raw/IMG_6682.MOV", 6.0, 8.0, card="c1", cin=1.0, fade_in=0.6)
    seq.append("a01")
    # 2 — 8.0-19.0  what a plaque can and cannot do
    raw("a02", "raw/IMG_6796.MOV", 44.5, 5.0, card="c2", cin=0.8)
    raw("a03", "raw/IMG_6807.MOV", 2.0, 6.0)
    seq += ["a02", "a03"]
    # 3 — 19.0-31.8  experience zones, no permanent installation
    clip("a04", f"{OUT}/n05.mp4", 0.0, 6.4, card="c3", cin=1.6)
    clip("a05", f"{OUT}/n14.mp4", 0.0, 6.4)
    seq += ["a04", "a05"]
    # 4 — 31.8-44.6  Dakota, entering from the real plate
    raw("a06", "raw/IMG_6804.MOV", 17.5, 4.0)
    clip("a07", f"{OUT}/n06.mp4", 0.0, 5.4, card="c4", cin=2.6)
    clip("a08", f"{IN}/s07.mp4", 0.0, 3.4)
    seq += ["a06", "a07", "a08"]
    # 5 — 44.6-56.0  the mill at its original scale
    raw("a09", "raw/IMG_6805.MOV", 22.0, 4.0)
    clip("a10", f"{OUT}/n08.mp4", 0.0, 4.0, card="c5", cin=1.4)
    clip("a11", f"{IN}/s09.mp4", 0.0, 3.4)
    seq += ["a09", "a10", "a11"]
    # 6 — 56.0-67.6  geology first, then deep time
    raw("a12", "raw/IMG_6682.MOV", 18.0, 5.0)
    clip("a13", f"{IN}/s10.mp4", 0.0, 6.6, card="c6", cin=3.4)
    seq += ["a12", "a13"]
    # 7 — 67.6-81.6  the device, kept plain
    clip("a14", f"{OUT}/prod_long.mp4", 0.0, 8.6, card="c7", cin=1.6)
    clip("a15", f"{IN}/s12.mp4", 0.0, 2.0)
    clip("a16", f"{IN}/s13.mp4", 0.0, 3.4)
    seq += ["a14", "a15", "a16"]
    # 8 — 81.6-95.6  shared, and still moving through the park
    clip("a17", f"{OUT}/sync_long.mp4", 0.0, 7.4, card="c8", cin=1.2)
    clip("a18", f"{OUT}/n14.mp4", 0.0, 6.6)
    seq += ["a17", "a18"]
    # 9 — 95.6-108.4  one route, multiple eras
    raw("a19", "raw/IMG_6799.MOV", 1.0, 5.0)
    clip("a20", f"{IN}/s16.mp4", 0.0, 7.8)
    seq += ["a19", "a20"]
    # 10 — 108.4-118.4  expand the story, preserve the place
    raw("a21", "raw/IMG_6799.MOV", 6.2, 5.0, card="c10", cin=0.8)
    raw("a22", "raw/IMG_6808.MOV", 25.6, 5.0, fade_out=0.6)
    seq += ["a21", "a22"]
    # 11 — 118.4-122.4  brand
    run(["ffmpeg", "-v", "error", "-loop", "1", "-t", "4.0",
         "-i", f"{CARD}/brand.png", "-filter_complex",
         f"[0:v]fps={FPS},format=yuv420p,fade=t=in:st=0:d=0.6,"
         "fade=t=out:st=3.2:d=0.8,setsar=1[v]",
         "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "medium",
         "-crf", "17", f"{OUT}/a23.mp4", "-y"])
    seq.append("a23")
    with open(f"{OUT}/concat.txt", "w") as f:
        for s in seq:
            f.write(f"file '{s}.mp4'\n")
    run(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", f"{OUT}/concat.txt", "-c", "copy", f"{OUT}/video.mp4", "-y"])
    print("concat done")


TOTAL = 122.4
CUES = [
    (f"{AU}/score_long.wav", 0.0, 0.58, 92.0),
    (f"{AU}/score_long.wav", 92.0, 0.62, 31.0),
    (f"{AU}/p01.mp3", 1.2, 1.0, None),
    (f"{AU}/p02.mp3", 8.8, 1.0, None),
    (f"{AU}/p03.mp3", 19.8, 1.0, None),
    (f"{AU}/p04.mp3", 33.0, 1.0, None),
    (f"{AU}/p05.mp3", 45.6, 1.0, None),
    (f"{AU}/p06.mp3", 57.0, 1.0, None),
    (f"{AU}/p07.mp3", 68.6, 1.0, None),
    (f"{AU}/p08.mp3", 82.6, 1.0, None),
    (f"{AU}/p09.mp3", 96.6, 1.0, None),
    (f"{AU}/p10.mp3", 109.4, 1.0, None),
    (f"{AU}/p11.mp3", 119.0, 1.0, None),
    (f"{AU}/amb_falls.wav", 0.0, 0.85, 8.0),
    (f"{AU}/amb_park.wav", 8.0, 0.5, 11.0),
    (f"{AU}/amb_park.wav", 31.8, 0.45, 12.8),
    (f"{AU}/fire.wav", 45.0, 0.35, 3.0),
    (f"{AU}/amb_falls.wav", 56.0, 0.55, 5.0),
    (f"{AU}/wind.wav", 60.5, 0.5, 6.0),
    (f"{AU}/rumble.wav", 61.5, 0.45, None),
    (f"{AU}/amb_park.wav", 81.6, 0.45, 14.0),
    (f"{AU}/amb_falls.wav", 108.4, 0.4, 10.0),
    (f"{AU}/scan.wav", 20.8, 0.75, None),
    (f"{AU}/scan.wav", 36.8, 0.7, None),
    (f"{AU}/scan.wav", 49.2, 0.65, None),
    (f"{AU}/scan.wav", 62.2, 0.6, None),
    (f"{AU}/tick.wav", 100.8, 0.45, None),
    (f"{AU}/tick.wav", 101.7, 0.45, None),
    (f"{AU}/tick.wav", 102.6, 0.45, None),
]


def build_audio():
    inputs = []
    for f, *_ in CUES:
        inputs += ["-i", f]
    fc, labels = [], []
    for i, (f, st, g, trim) in enumerate(CUES):
        ops = []
        if trim:
            ops += [f"atrim=0:{trim}", "asetpts=PTS-STARTPTS",
                    f"afade=t=in:d=0.6,afade=t=out:st={max(trim-0.9,0.1)}:d=0.9"]
        ops += [f"volume={g}", f"adelay={int(st*1000)}|{int(st*1000)}"]
        fc.append(f"[{i}:a]" + ",".join(ops) + f"[a{i}]")
        labels.append(f"[a{i}]")
    fc.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0,"
              f"afade=t=out:st={TOTAL-1.6}:d=1.6,"
              "loudnorm=I=-15:TP=-1.5:LRA=11[out]")
    run(["ffmpeg", "-v", "error"] + inputs +
        ["-filter_complex", ";".join(fc), "-map", "[out]", "-ar", "44100",
         f"{OUT}/mix.wav", "-y"])
    print("audio mixed")


def mux():
    run(["ffmpeg", "-v", "error", "-i", f"{OUT}/video.mp4", "-i", f"{OUT}/mix.wav",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "224k", "-shortest",
         "-movflags", "+faststart", "out/ORI_V4_partner_master.mp4", "-y"])
    print("muxed")


if __name__ == "__main__":
    cards()
    build_video()
    build_audio()
    mux()
