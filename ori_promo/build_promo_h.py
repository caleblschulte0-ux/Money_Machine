#!/usr/bin/env python3
"""Assemble the HORIZONTAL (1920x1080, 30fps) ORI promo.

v2 notes vs the vertical cut:
  - native 16:9, no vertical crops (fixes the bad-crop shots)
  - the extreme sign close-up beat is replaced with the overlook-deck shot
  - two AI "time layer" beats (settlers 1873 / glacial era) enter with a
    white-flash + whoosh, animated with a slow zoom (Ken Burns)
"""
import subprocess
import sys

FPS = 30
SFX = "/home/user/Shorts-pipeline/assets/sfx"
O = "work/overlays_h"

# (name, src, in_ts, dur, kind, overlays[, extra])
#   kind: "video" | "still_in" (zoom 1->1.1) | "still_out" (zoom 1.12->1)
#   overlays: (png, t_in, rise_px)
#   flash=True -> segment opens with a white flash
SEGS = [
    ("s1", "raw/IMG_6682.MOV", 17.5, 4.4, "video",
     [(f"{O}/hook.png", 0.45, 40)], False),
    ("s2a", "raw/IMG_6790.MOV", 18.0, 2.6, "video", [], False),
    ("s2b", "raw/IMG_6796.MOV", 15.5, 2.8, "video", [], False),
    ("s3", "raw/IMG_6799.MOV", 1.0, 4.6, "video",
     [(f"{O}/brand.png", 0.7, 46)], False),
    ("s4a", "raw/IMG_6806.MOV", 40.5, 3.4, "video",
     [(f"{O}/hud.png", 0.0, 0), (f"{O}/card_mill.png", 0.55, 46)], False),
    ("s4b", "raw/IMG_6804.MOV", 23.0, 3.3, "video",
     [(f"{O}/hud.png", 0.0, 0), (f"{O}/card_river.png", 0.45, 46)], False),
    ("s5a", None, 0, 5.0, "timelayer_1873", [], False),
    ("s5b", None, 0, 5.0, "timelayer_ice", [], False),
    ("s6", "raw/IMG_6805.MOV", 41.0, 3.8, "video", [], False),
    ("s7", "raw/IMG_6682.MOV", 6.0, 5.9, "video",
     [(f"{O}/endcard.png", 0.5, 40)], False),
]

VO = [
    ("work/vo1.mp3", 0.45),
    ("work/vo2.mp3", 4.55),
    ("work/vo3.mp3", 10.10),
    ("work/vo4h.mp3", 14.70),
    ("work/vo5h.mp3", 21.60),
    ("work/vo5.mp3", 31.40),   # "No tour group..."
    ("work/vo6.mp3", 35.30),   # "Open Range Interactive. See the story..."
]

ACCENTS = [
    (f"{SFX}/whoosh.wav", 9.85, 0.55),   # brand reveal
    (f"{SFX}/pop.wav", 15.05, 0.6),      # mill card
    (f"{SFX}/pop.wav", 18.15, 0.6),      # river card
    (f"{SFX}/whoosh.wav", 22.30, 0.65),  # repaint wipe -> 1873
    (f"{SFX}/whoosh.wav", 27.30, 0.65),  # repaint wipe -> glacial
    (f"{SFX}/riser.wav", 33.30, 0.45),   # into end card
    (f"{SFX}/boom.wav", 35.05, 0.5),     # logo lands
]

# The AR "repaint": same continuous real shot; at WIPE_AT a wiperight
# sweeps the treated version (grade + holograms/snow + chip) across the
# frame — the glasses painting the past onto the place you're standing.
WIPE_AT, WIPE_DUR = 1.3, 0.7


def timelayer_1873(name, dur):
    src, in_ts = "raw/IMG_6791.MOV", 12.5
    cmd = ["ffmpeg", "-v", "error",
           "-ss", str(in_ts), "-t", str(dur), "-i", src,          # 0 base
           "-loop", "1", "-t", str(dur), "-i", f"{O}/settlers_holo.png",  # 1
           "-loop", "1", "-t", str(dur), "-i", f"{O}/hud.png",            # 2
           "-loop", "1", "-t", str(dur), "-i", f"{O}/chip_1873.png"]      # 3
    chip_t = WIPE_AT + WIPE_DUR + 0.2
    fc = (
        "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
        f"crop=1920:1080,fps={FPS},split=2[a][b];"
        # 1873 mode: sepia-leaning grade + grain, ghosts bob gently
        "[b]eq=saturation=0.72:brightness=-0.02:contrast=1.04,"
        "colorbalance=rs=.10:gs=.02:bs=-.12:rm=.06:bm=-.08,noise=alls=7:allf=t[bg];"
        "[1:v]format=rgba[holo];"
        "[bg][holo]overlay=x=0:y='6*sin(2*PI*t/2.6)'[bh];"
        f"[a]trim=0:{WIPE_AT + WIPE_DUR},setpts=PTS-STARTPTS,settb=AVTB[a2];"
        f"[bh]trim={WIPE_AT}:{dur},setpts=PTS-STARTPTS,settb=AVTB[b2];"
        f"[a2][b2]xfade=transition=wiperight:duration={WIPE_DUR}:offset={WIPE_AT}[x];"
        "[x][2:v]overlay=0:0[xh];"
        f"[3:v]format=rgba,fade=t=in:st={chip_t}:d=0.3:alpha=1[chip];"
        f"[xh][chip]overlay=x=0:y='-36*max(0,1-min((t-{chip_t})/0.35,1))'"
        f":enable='gte(t,{chip_t})',fps={FPS},setsar=1,format=yuv420p[vout]")
    cmd += ["-filter_complex", fc, "-map", "[vout]", "-an",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            f"work/h_{name}.mp4", "-y"]
    run(cmd)
    print("built", name)


def timelayer_ice(name, dur):
    src, in_ts = "raw/IMG_6682.MOV", 24.0
    cmd = ["ffmpeg", "-v", "error",
           "-ss", str(in_ts), "-t", str(dur / 2), "-i", src,  # 0 (slowed 2x)
           "-i", "work/snow.mp4",                              # 1
           "-loop", "1", "-t", str(dur), "-i", f"{O}/hud.png",       # 2
           "-loop", "1", "-t", str(dur), "-i", f"{O}/chip_ice.png"]  # 3
    chip_t = WIPE_AT + WIPE_DUR + 0.2
    fc = (
        "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
        f"crop=1920:1080,setpts=2*PTS,fps={FPS},split=2[a][b];"
        # glacial mode: cold desaturated grade, water crawling at half speed
        "[b]eq=saturation=0.30:brightness=0.07:contrast=1.07,"
        "colorbalance=bs=.28:bm=.18:bh=.10:rs=-.06,"
        "curves=lighter[bg];"
        "[1:v]fps=30[snowv];[bg][snowv]blend=all_mode=screen:all_opacity=0.85[bs];"
        f"[a]trim=0:{WIPE_AT + WIPE_DUR},setpts=PTS-STARTPTS,settb=AVTB[a2];"
        f"[bs]trim={WIPE_AT}:{dur},setpts=PTS-STARTPTS,settb=AVTB[b2];"
        f"[a2][b2]xfade=transition=wiperight:duration={WIPE_DUR}:offset={WIPE_AT}[x];"
        "[x][2:v]overlay=0:0[xh];"
        f"[3:v]format=rgba,fade=t=in:st={chip_t}:d=0.3:alpha=1[chip];"
        f"[xh][chip]overlay=x=0:y='-36*max(0,1-min((t-{chip_t})/0.35,1))'"
        f":enable='gte(t,{chip_t})',fps={FPS},setsar=1,format=yuv420p[vout]")
    cmd += ["-filter_complex", fc, "-map", "[vout]", "-an",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            f"work/h_{name}.mp4", "-y"]
    run(cmd)
    print("built", name)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2000:])
        sys.exit(f"FAILED: {' '.join(cmd[:8])}...")


def build_segments():
    for name, src, in_ts, dur, kind, overlays, flash in SEGS:
        if kind == "timelayer_1873":
            timelayer_1873(name, dur)
            continue
        if kind == "timelayer_ice":
            timelayer_ice(name, dur)
            continue
        cmd = ["ffmpeg", "-v", "error"]
        cmd += ["-ss", str(in_ts), "-t", str(dur), "-i", src]
        base = ("scale=1920:1080:force_original_aspect_ratio=increase,"
                "crop=1920:1080")
        for png, _, _ in overlays:
            cmd += ["-loop", "1", "-t", str(dur), "-i", png]
        chain = "[0:v]" + base
        n = 1
        for i, (png, t_in, rise) in enumerate(overlays):
            chain += f"[v{n}];"
            y = f"'-{rise}*max(0,1-min((t-{t_in})/0.35,1))'" if rise else "0"
            chain += (f"[{i+1}:v]format=rgba,fade=t=in:st={t_in}:d=0.3:alpha=1[o{i}];"
                      f"[v{n}][o{i}]overlay=x=0:y={y}:enable='gte(t,{t_in})'")
            n += 1
        if flash:
            chain += ",fade=t=in:st=0:d=0.28:color=white"
        chain += f",fps={FPS},setsar=1,format=yuv420p[vout]"
        cmd += ["-filter_complex", chain, "-map", "[vout]", "-an",
                "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                f"work/h_{name}.mp4", "-y"]
        run(cmd)
        print("built", name)


def concat():
    with open("work/concat_h.txt", "w") as f:
        for name, *_ in SEGS:
            f.write(f"file 'h_{name}.mp4'\n")
    run(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", "work/concat_h.txt", "-c", "copy", "work/h_video.mp4", "-y"])
    print("concatenated")


def mix_audio(total):
    inputs = ["-i", "work/music.wav"]
    for f, _ in VO:
        inputs += ["-i", f]
    for f, _, _ in ACCENTS:
        inputs += ["-i", f]
    fc = [f"[0:a]volume=0.9,atrim=0:{total},asetpts=PTS-STARTPTS[mus]"]
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
         "-ar", "44100", "work/h_audio.wav", "-y"])
    print("audio mixed")


def mux(out="out/ORI_promo_horizontal.mp4"):
    run(["ffmpeg", "-v", "error", "-i", "work/h_video.mp4",
         "-i", "work/h_audio.wav",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
         "-movflags", "+faststart", out, "-y"])
    print("muxed ->", out)


if __name__ == "__main__":
    total = sum(s[3] for s in SEGS)
    print("total:", total)
    build_segments()
    concat()
    mix_audio(total)
    mux()
