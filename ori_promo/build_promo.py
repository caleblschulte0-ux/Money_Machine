#!/usr/bin/env python3
"""Assemble the Open Range Interactive AR-glasses promo (1080x1920, 30fps).

Reads raw iPhone footage in raw/, overlays in work/overlays/, VO in work/.
Two shot treatments:
  - "crop":  full-height vertical center-ish crop (scenic / people beats)
  - "glass": letterboxed 16:9 on a blurred, darkened self-background with
             the ORI HUD framed around it (the through-the-glasses beats)
Every AR card fades in with a little rise; whoosh/pop/riser accents come
from Shorts-pipeline assets/sfx; the music bed is synthesized in synth_music.py.
"""
import json
import subprocess
import sys

FPS = 30
W, H = 1080, 1920
SFX = "/home/user/Shorts-pipeline/assets/sfx"
OV = "work/overlays"

# (name, src, in_ts, dur, treatment, crop_frac, overlays)
#   crop_frac: horizontal center of the crop window as a fraction of the
#   scaled width (0.5 = center). Only used by "crop".
#   overlays: list of (png, t_in, rise_px) relative to segment start.
SEGS = [
    ("s1", "raw/IMG_6682.MOV", 17.5, 4.4, "crop", 0.50,
     [(f"{OV}/hook.png", 0.45, 40)]),
    ("s2a", "raw/IMG_6709.MOV", 3.0, 2.6, "crop", 0.50, []),
    ("s2b", "raw/IMG_6796.MOV", 16.0, 2.9, "crop", 0.50, []),
    ("s3", "raw/IMG_6799.MOV", 1.0, 4.6, "crop", 0.50,
     [(f"{OV}/brand.png", 0.7, 46)]),
    ("s4a", "raw/IMG_6806.MOV", 40.5, 3.4, "glass", 0.50,
     [(f"{OV}/hud.png", 0.0, 0), (f"{OV}/card_mill.png", 0.55, 46)]),
    ("s4b", "raw/IMG_6804.MOV", 23.0, 3.3, "glass", 0.50,
     [(f"{OV}/hud.png", 0.0, 0), (f"{OV}/card_river.png", 0.45, 46)]),
    ("s4c", "raw/IMG_6798.MOV", 20.0, 3.1, "glass", 0.50,
     [(f"{OV}/hud.png", 0.0, 0), (f"{OV}/card_walk.png", 0.45, 46)]),
    ("s5", "raw/IMG_6805.MOV", 41.0, 3.8, "crop", 0.50, []),
    ("s6", "raw/IMG_6682.MOV", 6.0, 5.9, "crop", 0.50,
     [(f"{OV}/endcard.png", 0.5, 40)]),
]

# VO placement: (file, start_time_in_final)
VO = [
    ("work/vo1.mp3", 0.45),
    ("work/vo2.mp3", 4.60),
    ("work/vo3.mp3", 10.20),
    ("work/vo4.mp3", 14.70),
    ("work/vo5.mp3", 24.40),
    ("work/vo6.mp3", 28.60),
]

# SFX accents: (file, start, volume)
ACCENTS = [
    (f"{SFX}/whoosh.wav", 9.95, 0.55),    # into brand reveal
    (f"{SFX}/pop.wav", 14.95, 0.6),       # card_mill pops
    (f"{SFX}/pop.wav", 18.25, 0.6),       # card_river pops
    (f"{SFX}/pop.wav", 21.55, 0.6),       # card_walk pops
    (f"{SFX}/riser.wav", 26.10, 0.45),    # into end card
    (f"{SFX}/boom.wav", 28.35, 0.5),      # logo lands
]


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2000:])
        sys.exit(f"FAILED: {' '.join(cmd[:8])}...")


def seg_filters(treatment, crop_frac, overlays, dur):
    """Video filtergraph for one segment."""
    parts = []
    if treatment == "crop":
        # full-height vertical crop; iPhone rotation is auto-applied.
        # Portrait sources scale straight to 1080x1920.
        parts.append(
            "scale=w='if(gte(iw/ih,1080/1920),-2,1080)':h='if(gte(iw/ih,1080/1920),1920,-2)',"
            f"crop=1080:1920:x='min(max(iw*{crop_frac}-540,0),iw-1080)':y='(ih-1920)/2'")
    else:  # glass: blurred self bg + sharp 16:9 band
        parts.append(
            "split=2[bg][fg];"
            "[bg]scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,gblur=sigma=24,eq=brightness=-0.18:saturation=0.85[bgv];"
            "[fg]scale=1000:-2[fgv];[bgv][fgv]overlay=x=40:y=(1920-overlay_h)/2")
    chain = "[0:v]" + parts[0]
    n = 1
    for i, (png, t_in, rise) in enumerate(overlays):
        chain += f"[v{n}];"
        y = f"'-{rise}*max(0,1-min((t-{t_in})/0.35,1))'" if rise else "0"
        chain += (f"[{i+1}:v]format=rgba,fade=t=in:st={t_in}:d=0.3:alpha=1[o{i}];"
                  f"[v{n}][o{i}]overlay=x=0:y={y}:enable='gte(t,{t_in})'")
        n += 1
    chain += f",fps={FPS},setsar=1,format=yuv420p[vout]"
    return chain


def build_segments():
    for name, src, in_ts, dur, treatment, crop_frac, overlays in SEGS:
        cmd = ["ffmpeg", "-v", "error", "-ss", str(in_ts), "-t", str(dur), "-i", src]
        for png, _, _ in overlays:
            cmd += ["-loop", "1", "-t", str(dur), "-i", png]
        fc = seg_filters(treatment, crop_frac, overlays, dur)
        cmd += ["-filter_complex", fc, "-map", "[vout]", "-an",
                "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                f"work/{name}.mp4", "-y"]
        run(cmd)
        print("built", name)


def concat_video():
    with open("work/concat.txt", "w") as f:
        for name, *_ in SEGS:
            f.write(f"file '{name}.mp4'\n")
    run(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", "work/concat.txt", "-c", "copy", "work/video_noaudio.mp4", "-y"])
    print("concatenated")


def mix_audio(total):
    """VO + music bed + accents -> master audio."""
    inputs = ["-i", "work/music.wav"]
    for f, _ in VO:
        inputs += ["-i", f]
    for f, _, _ in ACCENTS:
        inputs += ["-i", f]
    fc = []
    fc.append(f"[0:a]volume=0.9,atrim=0:{total},asetpts=PTS-STARTPTS[mus]")
    labels = ["[mus]"]
    idx = 1
    for f, st in VO:
        fc.append(f"[{idx}:a]adelay={int(st*1000)}|{int(st*1000)},volume=1.0[vo{idx}]")
        labels.append(f"[vo{idx}]")
        idx += 1
    for f, st, vol in ACCENTS:
        fc.append(f"[{idx}:a]adelay={int(st*1000)}|{int(st*1000)},volume={vol}[fx{idx}]")
        labels.append(f"[fx{idx}]")
        idx += 1
    fc.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0,"
              f"afade=t=out:st={total-1.2}:d=1.2,"
              "loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
    run(["ffmpeg", "-v", "error"] + inputs +
        ["-filter_complex", ";".join(fc), "-map", "[aout]",
         "-ar", "44100", "work/master_audio.wav", "-y"])
    print("audio mixed")


def mux(out="out/ORI_promo.mp4"):
    run(["ffmpeg", "-v", "error", "-i", "work/video_noaudio.mp4",
         "-i", "work/master_audio.wav",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
         "-movflags", "+faststart", out, "-y"])
    print("muxed ->", out)


if __name__ == "__main__":
    total = sum(s[3] for s in SEGS)
    print("total duration:", total)
    build_segments()
    concat_video()
    mix_audio(total)
    mux()
