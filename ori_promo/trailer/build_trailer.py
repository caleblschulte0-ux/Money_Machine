#!/usr/bin/env python3
"""Assemble the Open Range Interactive concept trailer (1920x1080/30).

Twelve shots, ~82s. Straight cuts, two dips to black (into the product
scene and into the end card). Real-footage shots share one base grade
with per-shot exposure normalization; the three time layers composite
their animated element sequences before era grading so plate and
figures share light."""
import subprocess
import sys
import json

FPS = 30
UI = "trailer/ui"
SEQ = "trailer/seq"
AU = "trailer/audio"

BASE_GRADE = ("curves=m='0/0 0.5/0.5 0.86/0.83 1/0.97',"
              "eq=saturation=1.03:contrast=1.03")
GR_DAKOTA = ("eq=saturation=0.93:brightness=0.005:contrast=1.04,"
             "colorbalance=rs=.10:rm=.08:gs=.04:gm=.03:bs=-.07:bm=-.05")
GR_1873 = ("eq=saturation=0.68:brightness=-0.015:contrast=1.05,"
           "colorbalance=rs=.16:rm=.12:rh=.05:gs=.06:gm=.04:bs=-.16:bm=-.12,"
           "vignette=PI/5.4")
GR_ICE = ("colortemperature=temperature=8600,"
          "eq=saturation=0.45:brightness=0.05:contrast=1.05,"
          "curves=m='0/0.03 0.5/0.52 1/0.98'")


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2500:])
        sys.exit("FAILED: " + " ".join(map(str, cmd[:10])))


def push(z_end, dur):
    n = int(dur * FPS)
    return (f"scale=2020:1136:flags=lanczos,"
            f"zoompan=z='1+{z_end - 1}*on/{n}':x='(iw-iw/zoom)/2'"
            f":y='(ih-ih/zoom)/2':d=1:s=1920x1080:fps={FPS}")


def simple_shot(name, src, ss, dur, grade, overlays=(), fade_out=0.0,
                fade_in=0.0, zoom=None):
    """overlays: (png, t_in, rise)"""
    cmd = ["ffmpeg", "-v", "error", "-ss", str(ss), "-t", str(dur), "-i", src]
    for png, _, _ in overlays:
        cmd += ["-loop", "1", "-t", str(dur), "-i", png]
    parts = []
    base = ("[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
            f"crop=1920:1080,fps={FPS}," + grade)
    if zoom:
        base += "," + push(zoom, dur)
    parts.append(base + "[b0]")
    cur = "b0"
    for i, (png, t_in, rise) in enumerate(overlays):
        y = (f"'-{rise}*max(0,1-min((t-{t_in})/0.5,1))'" if rise else "0")
        parts.append(f"[{i + 1}:v]format=rgba,"
                     f"fade=t=in:st={t_in}:d=0.6:alpha=1[o{i}]")
        parts.append(f"[{cur}][o{i}]overlay=x=0:y={y}[b{i + 1}]")
        cur = f"b{i + 1}"
    tail = ""
    if fade_in:
        tail += f",fade=t=in:st=0:d={fade_in}"
    if fade_out:
        tail += f",fade=t=out:st={dur - fade_out}:d={fade_out}"
    parts.append(f"[{cur}]null{tail},setsar=1,format=yuv420p[v]")
    fc = ";".join(parts)
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", f"trailer/out/{name}.mp4", "-y"]
    run(cmd)
    print("shot", name)


def timelayer_shot(name, src, ss, dur, seq_dir, era_png, era_grade,
                   t_mat=1.2, zoom=1.03, slow=1.0):
    """Plate -> animated element seq fades in (materialize) -> era grade
    over the composite -> era label -> gentle push."""
    cmd = ["ffmpeg", "-v", "error",
           "-ss", str(ss), "-t", str(dur / slow), "-i", src,
           "-framerate", str(FPS), "-i", f"{seq_dir}/%04d.png",
           "-loop", "1", "-t", str(dur), "-i", era_png]
    slow_f = f"setpts={slow}*PTS," if slow != 1.0 else ""
    fc = ("[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
          f"crop=1920:1080,{slow_f}fps={FPS},{BASE_GRADE}[plate];"
          f"[1:v]format=rgba,fade=t=in:st={t_mat}:d=1.1:alpha=1[els];"
          f"[plate][els]overlay=0:0,{era_grade}[comp];"
          f"[2:v]format=rgba,fade=t=in:st={t_mat + 1.5}:d=0.6:alpha=1[era];"
          f"[comp][era]overlay=0:0," + push(zoom, dur) +
          ",setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", f"trailer/out/{name}.mp4", "-y"]
    run(cmd)
    print("shot", name)


def ice_shot(name, dur=10.0):
    """Live falls -> gradual freeze: winter grade + snow + haze dissolve
    in over ~3s, then the fauna sequence materializes."""
    cmd = ["ffmpeg", "-v", "error",
           "-ss", "24.0", "-t", str(dur), "-i", "raw/IMG_6682.MOV",   # 0 live
           "-loop", "1", "-t", str(dur), "-i", "work/ice_base.png",   # 1 frozen
           "-stream_loop", "-1", "-t", str(dur), "-i", "work/snow.mp4",  # 2
           "-framerate", str(FPS), "-i", f"{SEQ}/ice/%04d.png",       # 3 fauna
           "-loop", "1", "-t", str(dur), "-i", f"{UI}/haze.png",      # 4
           "-loop", "1", "-t", str(dur), "-i", f"{UI}/era_ice.png"]   # 5
    fc = (
        "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
        f"crop=1920:1080,fps={FPS},{BASE_GRADE},settb=AVTB[live];"
        f"[1:v]fps={FPS},{GR_ICE},format=gbrp[fr0];"
        f"[2:v]fps={FPS},format=gbrp,eq=brightness=-0.12[sn];"
        "[fr0][sn]blend=all_mode=screen:all_opacity=0.55,format=rgba[fr1];"
        "[4:v]format=rgba[hz];[fr1][hz]overlay=0:0[fr2];"
        f"[3:v]format=rgba,fade=t=in:st=4.6:d=0.9:alpha=1[fauna];"
        "[fr2][fauna]overlay=0:0[frozen];"
        "[frozen]settb=AVTB[frozenv];"
        f"[live]trim=0:4.6,setpts=PTS-STARTPTS,settb=AVTB[a2];"
        f"[frozenv]trim=1.6:{dur},setpts=PTS-STARTPTS,settb=AVTB[b2];"
        "[a2][b2]xfade=transition=fade:duration=3.0:offset=1.6[x];"
        f"[5:v]format=rgba,fade=t=in:st=6.0:d=0.6:alpha=1[era];"
        "[x][era]overlay=0:0," + push(1.035, dur) +
        ",setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", f"trailer/out/{name}.mp4", "-y"]
    run(cmd)
    print("shot", name)


def product_shot(name, dur=8.8):
    cmd = ["ffmpeg", "-v", "error",
           "-loop", "1", "-t", str(dur), "-i", f"{UI}/product_bg.png",
           "-loop", "1", "-t", str(dur), "-i", f"{UI}/glasses.png"]
    fc = (f"[0:v]fps={FPS},scale=1920:1080[bg];"
          "[1:v]format=rgba,fade=t=in:st=0.5:d=0.9:alpha=1[g];"
          "[bg][g]overlay=x=0:y='4*sin(2*PI*t/7)'[m];"
          f"[m]fade=t=in:st=0:d=0.5,fade=t=out:st={dur - 0.45}:d=0.45,"
          + push(1.02, dur) + ",setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", f"trailer/out/{name}.mp4", "-y"]
    run(cmd)
    print("shot", name)


def zone_shot(name, dur=5.2):
    cmd = ["ffmpeg", "-v", "error",
           "-ss", "41.2", "-t", str(dur), "-i", "raw/IMG_6805.MOV",
           "-loop", "1", "-t", str(dur), "-i", f"{UI}/zone.png",
           "-framerate", str(FPS), "-start_number", "0",
           "-i", f"{UI}/ring/%04d.png"]
    fc = ("[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
          f"crop=1920:1080,fps={FPS},{BASE_GRADE}[b];"
          "[1:v]format=rgba,fade=t=in:st=2.0:d=0.7:alpha=1[z];"
          "[b][z]overlay=0:0[b2];"
          "[2:v]format=rgba,setpts=PTS+1.8/TB[r];"
          "[b2][r]overlay=0:0:enable='between(t,1.8,2.8)',"
          "setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", f"trailer/out/{name}.mp4", "-y"]
    run(cmd)
    print("shot", name)


def map_shot(name, dur=6.5):
    cmd = ["ffmpeg", "-v", "error",
           "-loop", "1", "-t", str(dur), "-i", f"{UI}/map.png"]
    fc = (f"[0:v]fps={FPS}," + push(1.05, dur) +
          f",fade=t=in:st=0:d=0.5,fade=t=out:st={dur - 0.4}:d=0.4,"
          "setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", f"trailer/out/{name}.mp4", "-y"]
    run(cmd)
    print("shot", name)


def end_shot(name, dur=10.9):
    cmd = ["ffmpeg", "-v", "error",
           "-f", "lavfi", "-t", str(dur), "-i",
           f"color=c=0x050608:s=1920x1080:r={FPS}",
           "-loop", "1", "-t", str(dur), "-i", f"{UI}/wordmark.png",
           "-loop", "1", "-t", str(dur), "-i", f"{UI}/tagline.png",
           "-loop", "1", "-t", str(dur), "-i", f"{UI}/end_micro.png"]
    fc = ("[0:v][1:v]overlay=0:0:enable='gte(t,0)'[a];" )
    fc = ("[1:v]format=rgba,fade=t=in:st=0.9:d=1.1:alpha=1[w];"
          "[2:v]format=rgba,fade=t=in:st=3.1:d=1.0:alpha=1[tg];"
          "[3:v]format=rgba,fade=t=in:st=6.3:d=0.9:alpha=1[mc];"
          "[0:v][w]overlay=0:0[a];[a][tg]overlay=0:0[b];[b][mc]overlay=0:0,"
          f"fade=t=out:st={dur - 1.4}:d=1.4,setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", f"trailer/out/{name}.mp4", "-y"]
    run(cmd)
    print("shot", name)


SHOTS = ["s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "s09",
         "s10", "s11", "s12"]


def build_video():
    import os
    os.makedirs("trailer/out", exist_ok=True)
    simple_shot("s01", "raw/IMG_6682.MOV", 17.5, 6.8, BASE_GRADE,
                overlays=[(f"{UI}/locality.png", 0.8, 0),
                          (f"{UI}/hook_title.png", 2.0, 24)],
                zoom=1.05, fade_in=0.7)
    simple_shot("s02", "raw/IMG_6796.MOV", 15.5, 4.2, BASE_GRADE,
                overlays=[(f"{UI}/pin_mill.png", 0.8, 18)])
    simple_shot("s03", "raw/IMG_6790.MOV", 25.5, 3.6, BASE_GRADE,
                fade_out=0.45)
    product_shot("s04")
    zone_shot("s05")
    timelayer_shot("s06", "raw/IMG_6808.MOV", 25.6, 8.0, f"{SEQ}/dakota",
                   f"{UI}/era_dakota.png", GR_DAKOTA, slow=2.0)
    timelayer_shot("s07", "raw/IMG_6805.MOV", 27.0, 8.0, f"{SEQ}/settlement",
                   f"{UI}/era_1873.png", GR_1873)
    ice_shot("s08")
    simple_shot("s09", "raw/IMG_6806.MOV", 40.5, 5.5, BASE_GRADE,
                overlays=[(f"{UI}/sync.png", 1.0, 14),
                          (f"{UI}/pin_shared.png", 1.6, 0)])
    map_shot("s10")
    simple_shot("s11", "raw/IMG_6799.MOV", 1.0, 4.5, BASE_GRADE,
                zoom=1.04, fade_out=0.6)
    end_shot("s12")
    with open("trailer/out/concat.txt", "w") as f:
        for s in SHOTS:
            f.write(f"file '{s}.mp4'\n")
    run(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", "trailer/out/concat.txt", "-c", "copy",
         "trailer/out/video.mp4", "-y"])
    print("video concatenated")


# ---------------- audio ----------------

CUES = [
    # (file, start, gain, [trim_dur])
    (f"{AU}/score.wav", 0.0, 0.72, None),
    # VO
    (f"{AU}/v01.mp3", 0.9, 1.0, None),
    (f"{AU}/v02.mp3", 7.0, 1.0, None),
    (f"{AU}/v03.mp3", 15.3, 1.0, None),
    (f"{AU}/v04.mp3", 24.1, 1.0, None),
    (f"{AU}/v05.mp3", 30.5, 1.0, None),
    (f"{AU}/v06.mp3", 38.3, 1.0, None),
    (f"{AU}/v07.mp3", 46.3, 1.0, None),
    (f"{AU}/v08.mp3", 55.4, 1.0, None),
    (f"{AU}/v09.mp3", 60.7, 1.0, None),
    (f"{AU}/v10.mp3", 73.2, 1.0, None),
    # ambience
    (f"{AU}/amb_falls.wav", 0.0, 0.85, 7.2),
    (f"{AU}/amb_park.wav", 6.8, 0.5, 7.8),
    (f"{AU}/amb_park.wav", 23.4, 0.42, 21.2),
    (f"{AU}/amb_falls.wav", 44.6, 0.6, 4.6),
    (f"{AU}/wind.wav", 47.0, 0.55, 7.6),
    (f"{AU}/fire.wav", 37.6, 0.42, 7.0),
    (f"{AU}/rumble.wav", 49.2, 0.8, None),
    (f"{AU}/amb_falls.wav", 54.6, 0.5, 5.5),
    (f"{AU}/amb_falls.wav", 66.6, 0.35, 4.5),
    # UI + transitions
    (f"{AU}/tick.wav", 25.2, 0.6, None),
    (f"{AU}/shimmer.wav", 29.8, 0.9, None),
    (f"{AU}/shimmer.wav", 37.8, 0.8, None),
    (f"{AU}/shimmer.wav", 46.2, 1.1, None),
    (f"{AU}/tick.wav", 56.1, 0.4, None),
]

TOTAL = 82.0


def build_audio():
    inputs = []
    for f, *_ in CUES:
        inputs += ["-i", f]
    fc = []
    labels = []
    for i, (f, st, g, trim) in enumerate(CUES):
        chain = f"[{i}:a]"
        ops = []
        if trim:
            ops.append(f"atrim=0:{trim}")
            ops.append("asetpts=PTS-STARTPTS")
            ops.append(f"afade=t=in:d=0.6,afade=t=out:st={trim - 0.8}:d=0.8")
        ops.append(f"volume={g}")
        ops.append(f"adelay={int(st * 1000)}|{int(st * 1000)}")
        fc.append(chain + ",".join(ops) + f"[a{i}]")
        labels.append(f"[a{i}]")
    fc.append("".join(labels) +
              f"amix=inputs={len(labels)}:normalize=0,"
              f"afade=t=out:st={TOTAL - 1.6}:d=1.6,"
              "loudnorm=I=-15:TP=-1.5:LRA=11[aout]")
    run(["ffmpeg", "-v", "error"] + inputs +
        ["-filter_complex", ";".join(fc), "-map", "[aout]", "-ar", "44100",
         "trailer/out/mix.wav", "-y"])
    print("audio mixed")


def mux():
    run(["ffmpeg", "-v", "error", "-i", "trailer/out/video.mp4",
         "-i", "trailer/out/mix.wav", "-c:v", "copy", "-c:a", "aac",
         "-b:a", "224k", "-shortest", "-movflags", "+faststart",
         "out/ORI_trailer_master.mp4", "-y"])
    print("muxed -> out/ORI_trailer_master.mp4")


if __name__ == "__main__":
    build_video()
    build_audio()
    mux()
