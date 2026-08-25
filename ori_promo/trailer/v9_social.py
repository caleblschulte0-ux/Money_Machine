#!/usr/bin/env python3
"""V3 of five — SOCIAL SHORT, ~30s, 9:16 vertical.

Designed to work with the sound OFF: every idea is carried by a burned-in
caption, and the hook lands in the first 1.5 seconds. Re-framed from the
approved Demo v2 shot masters (silent), so no new rendering and no new
imagery — each shot gets its own crop x-offset chosen to keep its subject
inside the vertical frame.
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter
import numpy as np

sys.path.insert(0, "trailer")
from ui_kit import font

FPS = 30
W, H = 1080, 1920
IN = "trailer/out7"
OUT = "trailer/out9"
CAP = "trailer/cap9"
AU = "trailer/audio"


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2000:])
        sys.exit("FAILED: " + " ".join(map(str, cmd[:8])))


# (source, in-point, duration, crop x on the 1920-wide master, caption lines)
BEATS = [
    ("s02", 0.1, 3.4, 656, ["THIS PARK HAS A", "HISTORY YOU CAN'T SEE"]),
    ("s06", 1.2, 5.0, 800, ["DAKOTA CAMPED", "ON THESE ROCKS"]),
    ("s08", 0.6, 4.2, 987, ["THE MILL THAT", "DIDN'T LAST"]),
    ("s10", 1.4, 4.8, 336, ["AND BEFORE THAT —", "ICE"]),
    ("prod_clean", 0.1, 4.4, 656, ["SELF-CONTAINED", "AR GLASSES"]),
    ("s13", 0.1, 3.0, 656, ["NO PHONE.", "NO SIGNAL."]),
    ("sync_clean", 0.0, 3.0, -1, ["EVERYONE SEES", "THE SAME THING"]),
]
END = 3.4
TOTAL = sum(b[2] for b in BEATS) + END


def captions():
    """Big, high-contrast, bottom third, on a soft scrim so they survive
    any background. These carry the film when the sound is off."""
    os.makedirs(CAP, exist_ok=True)
    for i, (_, _, _, _, lines) in enumerate(BEATS):
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        # scrim
        grad = np.zeros((H, W, 4), np.uint8)
        yy = np.arange(H)[:, None]
        band = np.clip((yy - 1120) / 420, 0, 1) * np.clip((1760 - yy) / 240, 0, 1)
        grad[..., 3] = (band * 172).astype(np.uint8)
        img.alpha_composite(Image.fromarray(grad))
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        f = font("semi", 74)
        y = 1320
        for ln in lines:
            tw = d.textlength(ln, font=f)
            d.text(((W - tw) / 2, y), ln, font=f, fill=(255, 255, 255, 255))
            y += 96
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sh.paste(Image.new("RGBA", (W, H), (5, 8, 11, 255)), (0, 0),
                 lay.split()[3].point(lambda p: min(p, 205)))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(11)), (0, 3))
        img.alpha_composite(lay)
        img.save(f"{CAP}/{i:02d}.png")
    # end card
    img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    f1, f2, f3 = font("semi", 86), font("med", 40), font("med", 32)
    for txt, fo, y, col in (("OPEN RANGE", f1, 780, (255, 255, 255, 255)),
                            ("INTERACTIVE", f1, 884, (255, 255, 255, 255)),
                            ("The past, anchored to place.", f2, 1030,
                             (226, 232, 238, 250)),
                            ("Falls Park Beta · Sioux Falls, SD", f3, 1120,
                             (170, 178, 186, 245))):
        tw = d.textlength(txt, font=fo)
        d.text(((W - tw) / 2, y), txt, font=fo, fill=col)
    img.save(f"{CAP}/end.png")
    print("captions built")


def build_video():
    os.makedirs(OUT, exist_ok=True)
    names = []
    for i, (src, ss, dur, cx, _) in enumerate(BEATS):
        out = f"{OUT}/v{i:02d}.mp4"
        if cx < 0:
            # letterbox the full 16:9 plate so BOTH wearers stay in frame
            vf = (f"scale={W}:-2:flags=lanczos,fps={FPS},"
                  f"pad={W}:{H}:0:(oh-ih)/2:color=0x07090c")
        else:
            vf = (f"crop=608:1080:{cx}:0,scale={W}:{H}:flags=lanczos,fps={FPS}")
        run(["ffmpeg", "-v", "error", "-ss", str(ss), "-t", str(dur),
             "-i", (f"{OUT}/{src}.mp4" if src.startswith(("prod", "sync"))
                    else f"{IN}/{src}.mp4"),
             "-loop", "1", "-t", str(dur), "-i", f"{CAP}/{i:02d}.png",
             "-filter_complex",
             f"[0:v]{vf}[b];[1:v]format=rgba,fade=t=in:st=0.25:d=0.35:alpha=1"
             f",fade=t=out:st={dur - 0.4}:d=0.35:alpha=1[c];"
             "[b][c]overlay,setsar=1,format=yuv420p[v]",
             "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "medium",
             "-crf", "18", "-fps_mode", "cfr", "-r", str(FPS), out, "-y"])
        names.append(os.path.basename(out))
        print("beat", src, dur)
    run(["ffmpeg", "-v", "error", "-loop", "1", "-t", str(END),
         "-i", f"{CAP}/end.png",
         "-filter_complex",
         f"[0:v]fps={FPS},format=yuv420p,fade=t=in:st=0:d=0.4,"
         f"fade=t=out:st={END - 0.6}:d=0.6,setsar=1[v]",
         "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "medium",
         "-crf", "18", f"{OUT}/v99.mp4", "-y"])
    names.append("v99.mp4")
    with open(f"{OUT}/concat.txt", "w") as f:
        for n in names:
            f.write(f"file '{n}'\n")
    run(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", f"{OUT}/concat.txt", "-c", "copy", f"{OUT}/video.mp4", "-y"])
    print("concat done", TOTAL)


# no narration: the captions carry it. Music and location ambience only.
CUES = [
    (f"{AU}/score_long.wav", 0.0, 0.74, TOTAL),
    (f"{AU}/amb_falls.wav", 0.0, 0.75, 3.4),
    (f"{AU}/amb_park.wav", 3.4, 0.45, 9.2),
    (f"{AU}/wind.wav", 12.6, 0.5, 4.8),
    (f"{AU}/rumble.wav", 13.4, 0.5, None),
    (f"{AU}/amb_park.wav", 25.0, 0.4, 3.0),
    (f"{AU}/scan.wav", 4.2, 0.8, None),
    (f"{AU}/scan.wav", 9.0, 0.7, None),
    (f"{AU}/shimmer.wav", 17.6, 0.45, None),
    (f"{AU}/tick.wav", 22.2, 0.5, None),
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
                    f"afade=t=in:d=0.4,afade=t=out:st={max(trim-0.7,0.1)}:d=0.7"]
        ops += [f"volume={g}", f"adelay={int(st*1000)}|{int(st*1000)}"]
        fc.append(f"[{i}:a]" + ",".join(ops) + f"[a{i}]")
        labels.append(f"[a{i}]")
    fc.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0,"
              f"afade=t=out:st={TOTAL-1.0}:d=1.0,"
              "loudnorm=I=-15:TP=-1.5:LRA=11[out]")
    run(["ffmpeg", "-v", "error"] + inputs +
        ["-filter_complex", ";".join(fc), "-map", "[out]", "-ar", "44100",
         f"{OUT}/mix.wav", "-y"])
    print("audio mixed")


def mux():
    run(["ffmpeg", "-v", "error", "-i", f"{OUT}/video.mp4", "-i", f"{OUT}/mix.wav",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
         "-movflags", "+faststart", "out/ORI_V3_social_master.mp4", "-y"])
    print("muxed")


if __name__ == "__main__":
    captions()
    build_video()
    build_audio()
    mux()
