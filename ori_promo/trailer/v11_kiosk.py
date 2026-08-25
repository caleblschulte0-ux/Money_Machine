#!/usr/bin/env python3
"""V5 of five — KIOSK LOOP, exactly 60.0s, 16:9, no voiceover.

Built to ChatGPT's r13 spec. The hard part is the seam: one continuous
8-second Falls Park wide shot is split so its FIRST half plays at
0:56-1:00 and its SECOND half plays at 0:00-0:04. Played on repeat the
water keeps moving straight through the boundary — no duplicate frame,
no dissolve, no fade, no logo change. There is no end card, because a
loop has no end.
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
IN, OUT, CARD = "trailer/out7", "trailer/out11", "trailer/card11"
U5, U6, U7 = "trailer/ui5", "trailer/ui6", "trailer/ui7"
AU = "trailer/audio"
BASE = ("unsharp=5:5:-0.35:5:5:0,"
        "curves=m='0/0 0.08/0.055 0.5/0.49 0.86/0.82 1/0.94',"
        "eq=saturation=0.93:contrast=1.06:brightness=-0.01,"
        "colorbalance=rm=.04:gs=-.02,noise=alls=4:allf=t")
SEAM_SRC, SEAM_IN = "raw/IMG_6682.MOV", 6.0   # 8s continuous, split 4+4


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1800:])
        sys.exit("FAILED: " + " ".join(map(str, cmd[:8])))


# name: (primary line, secondary line or None)
MSG = {
    "m1": ("THE PAST IS STILL HERE", None),
    "m2": ("STEP INTO THE STORY", None),
    "m3": ("DAKOTA LIFE", "IN THIS PLACE"),
    "m4": ("THE QUEEN BEE MILL", "AT ITS ORIGINAL SCALE"),
    "m5": ("THE ICE AGE", "BENEATH THE FALLS"),
    "m6": ("OPEN RANGE INTERACTIVE", "SELF-CONTAINED AR"),
    "m7": ("NO PHONE", "NO SIGNAL"),
    "m8": ("SEE IT TOGETHER", None),
    "m9": ("ONE PARK", "MULTIPLE TIME LAYERS"),
}


def cards():
    """96px primary / 60px secondary, max two lines, inside 10% title-safe,
    on a scrim strong enough to hold at ten feet."""
    os.makedirs(CARD, exist_ok=True)
    for name, (a, b) in MSG.items():
        assert len(a) <= 28 and (b is None or len(b) <= 28), name
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        grad = np.zeros((H, W, 4), np.uint8)
        yy = np.arange(H)[:, None]
        band = np.clip((yy - 620) / 300, 0, 1) * np.clip((1030 - yy) / 170, 0, 1)
        grad[..., 3] = (band * 178).astype(np.uint8)
        img.alpha_composite(Image.fromarray(grad))
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        fa, fb = font("semi", 100), font("semi", 62)
        y = 762 if b else 800
        tw = d.textlength(a, font=fa)
        d.text(((W - tw) / 2, y), a, font=fa, fill=(255, 255, 255, 255))
        if b:
            tw = d.textlength(b, font=fb)
            d.text(((W - tw) / 2, y + 122), b, font=fb, fill=(238, 242, 246, 255))
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sh.paste(Image.new("RGBA", (W, H), (4, 7, 10, 255)), (0, 0),
                 lay.split()[3].point(lambda p: min(p, 215)))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(13)), (0, 4))
        img.alpha_composite(lay)
        img.save(f"{CARD}/{name}.png")
    print("kiosk cards built")


def seg(name, inputs, fc, dur):
    cmd = ["ffmpeg", "-v", "error"] + inputs + [
        "-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
        "-preset", "medium", "-crf", "17", "-fps_mode", "cfr", "-r", str(FPS),
        "-t", str(dur), f"{OUT}/{name}.mp4", "-y"]
    run(cmd)
    print("seg", name, dur)


def plate(name, src, ss, dur, card=None, cin=0.8, cout=None, zoom=None):
    inputs = ["-ss", str(ss), "-t", str(dur), "-i", src]
    if card:
        inputs += ["-loop", "1", "-t", str(dur), "-i", f"{CARD}/{card}.png"]
    zp = ""
    if zoom:
        n = int(dur * FPS)
        zp = (f",scale=2020:1136:flags=lanczos,zoompan=z='1+{zoom-1}*on/{n}'"
              f":x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=1920x1080:fps={FPS}")
    fc = (f"[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
          f"crop=1920:1080,fps={FPS},{BASE}{zp}[b]")
    cur = "b"
    if card:
        co = cout if cout is not None else dur - 0.8
        fc += (f";[1:v]format=rgba,fade=t=in:st={cin}:d=0.6:alpha=1,"
               f"fade=t=out:st={co}:d=0.6:alpha=1[c];[b][c]overlay[o]")
        cur = "o"
    fc += f";[{cur}]setsar=1,format=yuv420p[v]"
    seg(name, inputs, fc, dur)


def rendered(name, src, ss, dur, card=None, cin=0.8, cout=None, slow=1.0):
    inputs = ["-ss", str(ss), "-t", str(dur / slow), "-i", src]
    if card:
        inputs += ["-loop", "1", "-t", str(dur), "-i", f"{CARD}/{card}.png"]
    pre = f"setpts={slow}*PTS," if slow != 1.0 else ""
    fc = f"[0:v]{pre}fps={FPS}[b]"
    cur = "b"
    if card:
        co = cout if cout is not None else dur - 0.8
        fc += (f";[1:v]format=rgba,fade=t=in:st={cin}:d=0.6:alpha=1,"
               f"fade=t=out:st={co}:d=0.6:alpha=1[c];[b][c]overlay[o]")
        cur = "o"
    fc += f";[{cur}]setsar=1,format=yuv420p[v]"
    seg(name, inputs, fc, dur)


def build_video():
    os.makedirs(OUT, exist_ok=True)
    # --- 0:00-0:04  SECOND half of the seam shot, message fades up at 0.8
    plate("k00", SEAM_SRC, SEAM_IN + 4.0, 4.0, card="m1", cin=0.8, cout=3.2)
    # --- 0:04-0:11  zone
    rendered("k01", f"{OUT}/z_zone.mp4", 0.0, 7.0, card="m2", cin=1.0, cout=6.2)
    # --- 0:11-0:18  real plate, then Dakota
    plate("k02", "raw/IMG_6804.MOV", 17.5, 1.6)
    rendered("k03", f"{OUT}/z_dak.mp4", 0.0, 5.4, card="m3", cin=1.0, cout=4.6)
    # --- 0:18-0:25  ruins, then wagon at original scale
    plate("k04", "raw/IMG_6805.MOV", 22.0, 3.0)
    rendered("k05", f"{OUT}/z_set.mp4", 0.0, 4.0, card="m4", cin=0.6, cout=3.2)
    # --- 0:25-0:32  geology, then the mammoth after 0:27
    plate("k06", "raw/IMG_6682.MOV", 18.0, 0.7)
    rendered("k07", f"{IN}/s10.mp4", 0.0, 6.3, card="m5", cin=2.0, cout=5.5)
    # --- 0:32-0:39  the device, identified not sold
    rendered("k08", f"{OUT}/z_prod.mp4", 0.0, 5.0, card="m6", cin=0.8, cout=4.2)
    rendered("k09", f"{IN}/s12.mp4", 0.0, 2.0)
    # --- 0:39-0:45  worn, text opposite the subject
    rendered("k10", f"{OUT}/z_worn.mp4", 0.0, 6.0, card="m7", cin=0.8, cout=5.2)
    # --- 0:45-0:51  both wearers
    rendered("k11", f"{OUT}/sync_long.mp4", 0.0, 6.0, card="m8", cin=0.8, cout=5.2)
    # --- 0:51-0:56  map, text fully gone by 0:55.8
    rendered("k12", f"{OUT}/z_map.mp4", 0.0, 5.0, card="m9", cin=0.6, cout=4.2)
    # --- 0:56-1:00  FIRST half of the seam shot, no text, no fade
    plate("k13", SEAM_SRC, SEAM_IN, 4.0)
    order = ["k00", "k01", "k02", "k03", "k04", "k05", "k06", "k07",
             "k08", "k09", "k10", "k11", "k12", "k13"]
    with open(f"{OUT}/concat.txt", "w") as f:
        for k in order:
            f.write(f"file '{k}.mp4'\n")
    run(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", f"{OUT}/concat.txt", "-c", "copy", f"{OUT}/video.mp4", "-y"])
    print("concat done")


def build_audio():
    """A steady bed only. No swell, no resolve, nothing that would announce
    an ending at 60.0 — a kiosk viewer may arrive at any second."""
    run(["ffmpeg", "-v", "error",
         "-stream_loop", "-1", "-t", "60.0", "-i", f"{AU}/amb_falls.wav",
         "-stream_loop", "-1", "-t", "60.0", "-i", f"{AU}/amb_park.wav",
         "-stream_loop", "-1", "-t", "60.0", "-i", f"{AU}/score_long.wav",
         "-filter_complex",
         "[0:a]volume=0.62[a0];[1:a]volume=0.30[a1];[2:a]volume=0.34[a2];"
         "[a0][a1][a2]amix=inputs=3:normalize=0,"
         "loudnorm=I=-18:TP=-2.0:LRA=7[out]",
         "-map", "[out]", "-ar", "44100", f"{OUT}/mix.wav", "-y"])
    print("audio bed built")


def mux():
    run(["ffmpeg", "-v", "error", "-i", f"{OUT}/video.mp4", "-i", f"{OUT}/mix.wav",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
         "-movflags", "+faststart", "out/ORI_V5_kiosk_master.mp4", "-y"])
    print("muxed")


if __name__ == "__main__":
    cards()
    build_video()
    build_audio()
    mux()
