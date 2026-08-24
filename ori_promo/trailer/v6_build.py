#!/usr/bin/env python3
"""ORI Falls Park Demo v2 (v6) — ~89s 1080p demo film.

Extends the v5 trailer language into demo form: slower activation, a
second experience zone painted on real grass, a two-wearer shared-view
beat, and three beats of REAL product footage lifted from the operator's
own first demo (no new AI imagery anywhere).
"""
import os
import subprocess
import sys

FPS = 30
U5 = "trailer/ui5"
U6 = "trailer/ui6"
SEQ = "trailer/seq"
AU = "trailer/audio"
REF = ("/root/.claude/uploads/be5af791-3d77-56ef-9944-8170866e1297/"
       "f111d6ee-ORI_Falls_Park_Demo.MP4")

BASE = ("unsharp=5:5:-0.35:5:5:0,"
        "curves=m='0/0 0.08/0.055 0.5/0.49 0.86/0.82 1/0.94',"
        "eq=saturation=0.93:contrast=1.06:brightness=-0.01,"
        "colorbalance=rm=.04:gs=-.02,noise=alls=4:allf=t")
GR_ICE = ("colortemperature=temperature=8600,"
          "eq=saturation=0.45:brightness=0.05:contrast=1.05,"
          "curves=m='0/0.03 0.5/0.52 1/0.98'")


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2500:])
        sys.exit("FAILED: " + " ".join(map(str, cmd[:10])))


def push(z, dur):
    n = int(dur * FPS)
    return (f"scale=2020:1136:flags=lanczos,"
            f"zoompan=z='1+{z - 1}*on/{n}':x='(iw-iw/zoom)/2'"
            f":y='(ih-ih/zoom)/2':d=1:s=1920x1080:fps={FPS}")


def O(name):
    return f"trailer/out6/{name}.mp4"


def shot(name, src, ss, dur, overlays=(), crop=None, zoom=None, slow=1.0,
         fade_in=0.0, fade_out=0.0, seq=None, extra=""):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(ss), "-t", str(dur / slow),
           "-i", src]
    if seq:
        cmd += ["-framerate", str(FPS), "-i", f"{seq}/%04d.png"]
    for png, _, _ in overlays:
        cmd += ["-loop", "1", "-t", str(dur), "-i", png]
    pre = ""
    if crop:
        pre += "crop=%d:%d:%d:%d," % (crop[2] - crop[0], crop[3] - crop[1],
                                      crop[0], crop[1])
    if slow != 1.0:
        pre += f"setpts={slow}*PTS,"
    parts = [f"[0:v]{pre}scale=1920:1080:force_original_aspect_ratio=increase,"
             f"crop=1920:1080,fps={FPS},{BASE}{extra}" +
             (("," + push(zoom, dur)) if zoom else "") + "[b0]"]
    cur, idx = "b0", 1
    if seq:
        parts.append(f"[{idx}:v]format=rgba[sq]")
        parts.append(f"[{cur}][sq]overlay=0:0[b1]")
        cur, idx = "b1", idx + 1
    for i, (png, t_in, t_out) in enumerate(overlays):
        f = f"[{idx}:v]format=rgba,fade=t=in:st={t_in}:d=0.45:alpha=1"
        if t_out:
            f += f",fade=t=out:st={t_out}:d=0.4:alpha=1"
        parts.append(f + f"[o{i}]")
        parts.append(f"[{cur}][o{i}]overlay=0:0[c{i}]")
        cur, idx = f"c{i}", idx + 1
    tail = ""
    if fade_in:
        tail += f",fade=t=in:st=0:d={fade_in}"
    if fade_out:
        tail += f",fade=t=out:st={dur - fade_out}:d={fade_out}"
    parts.append(f"[{cur}]null{tail},setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "[v]", "-an",
            "-c:v", "libx264", "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def coldopen(name, dur=2.4):
    cmd = ["ffmpeg", "-v", "error",
           "-f", "lavfi", "-t", str(dur), "-i",
           f"color=c=0x07090c:s=1920x1080:r={FPS}",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/wordmark.png"]
    fc = ("[1:v]format=rgba,fade=t=in:st=0.25:d=0.7:alpha=1,"
          f"fade=t=out:st={dur - 0.85}:d=0.7:alpha=1[w];"
          f"[0:v][w]overlay,fade=t=out:st={dur - 0.4}:d=0.4,"
          "setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def product(name, dur=7.0):
    cmd = ["ffmpeg", "-v", "error",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/stage_bg.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/hero.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/c1.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/c2.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/c3.png"]
    co = dur - 1.3
    fc = (f"[0:v]fps={FPS},scale=1920:1080[bg];"
          "[1:v]format=rgba,fade=t=in:st=0.4:d=0.8:alpha=1[h];"
          f"[2:v]format=rgba,fade=t=in:st=1.9:d=0.35:alpha=1,"
          f"fade=t=out:st={co}:d=0.4:alpha=1[c1];"
          f"[3:v]format=rgba,fade=t=in:st=2.9:d=0.35:alpha=1,"
          f"fade=t=out:st={co}:d=0.4:alpha=1[c2];"
          f"[4:v]format=rgba,fade=t=in:st=3.9:d=0.35:alpha=1,"
          f"fade=t=out:st={co}:d=0.4:alpha=1[c3];"
          "[bg][h]overlay[a];[a][c1]overlay[b];[b][c2]overlay[c];"
          "[c][c3]overlay[e];"
          f"[e]fade=t=in:st=0:d=0.4,fade=t=out:st={dur - 0.4}:d=0.4,"
          + push(1.035, dur) + ",setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def zone(name, dur=5.6):
    cmd = ["ffmpeg", "-v", "error",
           "-ss", "41.2", "-t", str(dur), "-i", "raw/IMG_6805.MOV",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/zone_trace.png",
           "-framerate", str(FPS), "-i", f"{U5}/zpulse/%04d.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/zone_label.png"]
    fc = ("[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
          f"crop=1920:1080,fps={FPS},{BASE}[b];"
          "[2:v]format=rgba,setpts=PTS+1.3/TB[p];"
          "[b][p]overlay=0:0:enable='between(t,1.3,2.2)'[b1];"
          "[1:v]format=rgba,fade=t=in:st=1.8:d=0.5:alpha=1[z];"
          "[b1][z]overlay[b2];"
          "[3:v]format=rgba,fade=t=in:st=2.5:d=0.4:alpha=1[t2];"
          "[b2][t2]overlay,setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def walkzone(name, dur=6.4):
    """Second zone, painted on the real foreground grass as a walker
    approaches (IMG_6807). Bigger, closer, terrain-conforming."""
    cmd = ["ffmpeg", "-v", "error",
           "-ss", "6.0", "-t", str(dur), "-i", "raw/IMG_6807.MOV",
           "-loop", "1", "-t", str(dur), "-i", f"{U6}/walk_trace.png",
           "-framerate", str(FPS), "-i", f"{U6}/wpulse/%04d.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U6}/walk_label.png"]
    fc = ("[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
          f"crop=1920:1080,fps={FPS},{BASE}[b];"
          "[2:v]format=rgba,setpts=PTS+1.5/TB[p];"
          "[b][p]overlay=0:0:enable='between(t,1.5,2.6)'[b1];"
          "[1:v]format=rgba,fade=t=in:st=2.0:d=0.55:alpha=1[z];"
          "[b1][z]overlay[b2];"
          "[3:v]format=rgba,fade=t=in:st=2.9:d=0.45:alpha=1[t2];"
          "[b2][t2]overlay,setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def sync2(name, dur=5.4):
    """Two wearers, one reconstruction. Head-anchored markers were cut:
    the handheld plate drifts, so static dots slide off the people."""
    cmd = ["ffmpeg", "-v", "error",
           "-ss", "9.0", "-t", str(dur), "-i", "raw/IMG_6806.MOV",
           "-loop", "1", "-t", str(dur), "-i", f"{U6}/sync2_title.png"]
    fc = ("[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
          f"crop=1920:1080,fps={FPS},{BASE}[b];"
          "[1:v]format=rgba,fade=t=in:st=1.6:d=0.5:alpha=1[t];"
          "[b][t]overlay,setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def ice(name, dur=9.4):
    cmd = ["ffmpeg", "-v", "error",
           "-ss", "24.0", "-t", str(dur), "-i", "raw/IMG_6682.MOV",
           "-loop", "1", "-t", str(dur), "-i", "work/ice_base.png",
           "-stream_loop", "-1", "-t", str(dur), "-i", "work/snow.mp4",
           "-framerate", str(FPS), "-i", f"{SEQ}/v6_ice/%04d.png",
           "-loop", "1", "-t", str(dur), "-i", "trailer/ui/haze.png"]
    fc = (
        "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
        f"crop=1920:1080,fps={FPS},{BASE},settb=AVTB[live];"
        f"[1:v]fps={FPS},{GR_ICE},format=gbrp[fr0];"
        f"[2:v]fps={FPS},format=gbrp,eq=brightness=-0.12[sn];"
        "[fr0][sn]blend=all_mode=screen:all_opacity=0.55,format=rgba[fr1];"
        "[4:v]format=rgba[hz];[fr1][hz]overlay[fr2];"
        "[3:v]format=rgba[fauna];[fr2][fauna]overlay[frozen];"
        "[frozen]settb=AVTB[fz];"
        "[live]trim=0:4.0,setpts=PTS-STARTPTS,settb=AVTB[a2];"
        f"[fz]trim=1.4:{dur},setpts=PTS-STARTPTS,settb=AVTB[b2];"
        "[a2][b2]xfade=transition=fade:duration=2.6:offset=1.4[x];"
        "[x]" + push(1.04, dur) + ",setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def brand(name, dur=7.0):
    cmd = ["ffmpeg", "-v", "error",
           "-f", "lavfi", "-t", str(dur), "-i",
           f"color=c=0x07090c:s=1920x1080:r={FPS}",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/stage_bg.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/hero.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/wordmark.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/tagline.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/micro.png"]
    fc = ("[1:v]format=rgba,fade=t=in:st=0:d=0.4:alpha=1,"
          "fade=t=out:st=1.7:d=0.5:alpha=1[bgf];"
          "[2:v]format=rgba,fade=t=in:st=0.1:d=0.4:alpha=1,"
          "fade=t=out:st=1.7:d=0.5:alpha=1[g];"
          "[0:v][bgf]overlay[z];[z][g]overlay[a];"
          "[3:v]format=rgba,fade=t=in:st=2.6:d=0.8:alpha=1[w];"
          "[4:v]format=rgba,fade=t=in:st=4.0:d=0.7:alpha=1[t];"
          "[5:v]format=rgba,fade=t=in:st=5.1:d=0.6:alpha=1[m];"
          "[a][w]overlay[b];[b][t]overlay[c];[c][m]overlay,"
          f"fade=t=out:st={dur - 1.0}:d=1.0,setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


SHOTS = [f"s{i:02d}" for i in range(19) if i != 8]
TOTAL = 86.2


def build_video():
    os.makedirs("trailer/out6", exist_ok=True)
    coldopen("s00")
    shot("s01", "raw/IMG_6682.MOV", 17.5, 4.6, zoom=1.05, fade_in=0.5,
         overlays=[(f"{U5}/hook.png", 1.0, 3.5)])
    shot("s02", "raw/IMG_6682.MOV", 5.0, 4.0, zoom=1.03)
    shot("s03", "raw/IMG_6803.MOV", 0.5, 3.6, zoom=1.04)
    shot("s04", "raw/IMG_6796.MOV", 44.5, 4.4, zoom=1.03,
         overlays=[(f"{U5}/mill_dot.png", 1.4, None)], fade_out=0.35)
    zone("s05")
    product("s06")
    # real product footage from the operator's own first demo
    shot("s07", REF, 90.85, 2.6, slow=1.35, fade_in=0.3)
    shot("s09", REF, 101.95, 2.8, slow=1.27, fade_out=0.35)
    shot("s10", "raw/IMG_6804.MOV", 23.5, 5.4, seq=f"{SEQ}/v6_dak_a",
         overlays=[(f"{U5}/era_dakota.png", 2.9, None)])
    shot("s11", "raw/IMG_6808.MOV", 25.6, 3.4, crop=(250, 300, 1470, 986),
         slow=1.4, seq=f"{SEQ}/v6_dak_b")
    shot("s12", "raw/IMG_6805.MOV", 27.5, 4.0, crop=(700, 300, 1920, 986),
         seq=f"{SEQ}/v6_set_a",
         overlays=[(f"{U5}/era_settle.png", 2.1, None)])
    shot("s13", "raw/IMG_6805.MOV", 31.9, 3.4, crop=(768, 336, 1920, 984),
         seq=f"{SEQ}/v6_set_b")
    ice("s14")
    walkzone("s15")
    sync2("s16")
    shot("s17", "raw/IMG_6799.MOV", 1.0, 4.8, zoom=1.045, fade_out=0.5,
         overlays=[(f"{U5}/release.png", 1.4, None)])
    brand("s18")
    with open("trailer/out6/concat.txt", "w") as f:
        for s in SHOTS:
            f.write(f"file '{s}.mp4'\n")
    run(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", "trailer/out6/concat.txt", "-c", "copy",
         "trailer/out6/video.mp4", "-y"])
    print("concat done")


CUES = [
    (f"{AU}/score_long.wav", 0.0, 0.62, TOTAL),
    # narration
    (f"{AU}/y01.mp3", 3.0, 1.0, None),
    (f"{AU}/y02.mp3", 7.6, 1.0, None),
    (f"{AU}/y03.mp3", 15.0, 1.0, None),
    (f"{AU}/y04.mp3", 19.6, 1.0, None),
    (f"{AU}/y05.mp3", 25.6, 1.0, None),
    (f"{AU}/y06.mp3", 37.8, 1.0, None),
    (f"{AU}/y07.mp3", 46.4, 1.0, None),
    (f"{AU}/y08.mp3", 54.8, 1.0, None),
    (f"{AU}/y09.mp3", 63.2, 1.0, None),
    (f"{AU}/y10.mp3", 75.2, 1.0, None),
    (f"{AU}/y11.mp3", 80.6, 1.0, None),
    # ambience
    (f"{AU}/amb_falls.wav", 2.4, 0.9, 8.6),
    (f"{AU}/amb_park.wav", 11.0, 0.5, 13.6),
    (f"{AU}/amb_park.wav", 37.0, 0.45, 16.2),
    (f"{AU}/fire.wav", 46.2, 0.4, 3.0),
    (f"{AU}/amb_falls.wav", 50.2, 0.55, 3.4),
    (f"{AU}/wind.wav", 55.7, 0.55, 6.4),
    (f"{AU}/creak.wav", 56.8, 0.6, None),
    (f"{AU}/rumble.wav", 58.8, 0.5, None),
    (f"{AU}/amb_park.wav", 62.6, 0.5, 11.4),
    (f"{AU}/amb_falls.wav", 74.4, 0.4, 4.8),
    # interface
    (f"{AU}/scan.wav", 21.0, 0.85, None),
    (f"{AU}/scan.wav", 38.8, 0.8, None),
    (f"{AU}/scan.wav", 43.0, 0.6, None),
    (f"{AU}/scan.wav", 46.6, 0.7, None),
    (f"{AU}/scan.wav", 50.2, 0.5, None),
    (f"{AU}/scan.wav", 64.6, 0.8, None),
    (f"{AU}/tick.wav", 20.3, 0.55, None),
    (f"{AU}/tick.wav", 64.1, 0.5, None),
    (f"{AU}/tick.wav", 70.0, 0.45, None),
    (f"{AU}/shimmer.wav", 31.6, 0.4, None),
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
                    f"afade=t=in:d=0.5,afade=t=out:st={trim - 0.8}:d=0.8"]
        ops += [f"volume={g}", f"adelay={int(st * 1000)}|{int(st * 1000)}"]
        fc.append(f"[{i}:a]" + ",".join(ops) + f"[a{i}]")
        labels.append(f"[a{i}]")
    fc.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0,"
              f"afade=t=out:st={TOTAL - 1.4}:d=1.4,"
              "loudnorm=I=-15:TP=-1.5:LRA=11[out]")
    run(["ffmpeg", "-v", "error"] + inputs +
        ["-filter_complex", ";".join(fc), "-map", "[out]", "-ar", "44100",
         "trailer/out6/mix.wav", "-y"])
    print("audio mixed")


def mux():
    run(["ffmpeg", "-v", "error", "-i", "trailer/out6/video.mp4",
         "-i", "trailer/out6/mix.wav", "-c:v", "copy", "-c:a", "aac",
         "-b:a", "224k", "-shortest", "-movflags", "+faststart",
         "out/ORI_demo_v2_master.mp4", "-y"])
    print("muxed")


if __name__ == "__main__":
    build_video()
    build_audio()
    mux()
