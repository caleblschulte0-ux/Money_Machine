#!/usr/bin/env python3
"""ORI pitch trailer v5 — 53.2s premium product film."""
import subprocess
import sys
import os

FPS = 30
U5 = "trailer/ui5"
SEQ = "trailer/seq"
AU = "trailer/audio"

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
    return f"trailer/out5/{name}.mp4"


def shot(name, src, ss, dur, overlays=(), crop=None, zoom=None, slow=1.0,
         fade_in=0.0, fade_out=0.0, seq=None):
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
             f"crop=1920:1080,fps={FPS},{BASE}" +
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


def product(name, dur=6.2):
    cmd = ["ffmpeg", "-v", "error",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/stage_bg.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/hero.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/c1.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/c2.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/c3.png"]
    co = 4.9
    fc = (f"[0:v]fps={FPS},scale=1920:1080[bg];"
          "[1:v]format=rgba,fade=t=in:st=0.4:d=0.8:alpha=1[h];"
          f"[2:v]format=rgba,fade=t=in:st=1.8:d=0.35:alpha=1,"
          f"fade=t=out:st={co}:d=0.4:alpha=1[c1];"
          f"[3:v]format=rgba,fade=t=in:st=2.6:d=0.35:alpha=1,"
          f"fade=t=out:st={co}:d=0.4:alpha=1[c2];"
          f"[4:v]format=rgba,fade=t=in:st=3.4:d=0.35:alpha=1,"
          f"fade=t=out:st={co}:d=0.4:alpha=1[c3];"
          "[bg][h]overlay[a];[a][c1]overlay[b];[b][c2]overlay[c];"
          "[c][c3]overlay[e];"
          f"[e]fade=t=in:st=0:d=0.4,fade=t=out:st={dur - 0.4}:d=0.4,"
          + push(1.035, dur) + ",setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def zone(name, dur=4.2):
    cmd = ["ffmpeg", "-v", "error",
           "-ss", "41.2", "-t", str(dur), "-i", "raw/IMG_6805.MOV",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/zone_trace.png",
           "-framerate", str(FPS), "-i", f"{U5}/zpulse/%04d.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/zone_label.png"]
    fc = ("[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
          f"crop=1920:1080,fps={FPS},{BASE}[b];"
          "[2:v]format=rgba,setpts=PTS+1.1/TB[p];"
          "[b][p]overlay=0:0:enable='between(t,1.1,1.98)'[b1];"
          "[1:v]format=rgba,fade=t=in:st=1.6:d=0.5:alpha=1[z];"
          "[b1][z]overlay[b2];"
          "[3:v]format=rgba,fade=t=in:st=2.3:d=0.4:alpha=1[t2];"
          "[b2][t2]overlay,setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def ice(name, dur=8.2):
    cmd = ["ffmpeg", "-v", "error",
           "-ss", "24.0", "-t", str(dur), "-i", "raw/IMG_6682.MOV",
           "-loop", "1", "-t", str(dur), "-i", "work/ice_base.png",
           "-stream_loop", "-1", "-t", str(dur), "-i", "work/snow.mp4",
           "-framerate", str(FPS), "-i", f"{SEQ}/v5_ice/%04d.png",
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
        "[live]trim=0:3.6,setpts=PTS-STARTPTS,settb=AVTB[a2];"
        f"[fz]trim=1.2:{dur},setpts=PTS-STARTPTS,settb=AVTB[b2];"
        "[a2][b2]xfade=transition=fade:duration=2.4:offset=1.2[x];"
        "[x]" + push(1.04, dur) + ",setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def sync(name, dur=3.8):
    cmd = ["ffmpeg", "-v", "error",
           "-ss", "40.5", "-t", str(dur), "-i", "raw/IMG_6806.MOV",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/sync_a.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/sync_join.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/sync_title.png"]
    fc = ("[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
          f"crop=1920:1080,fps={FPS},{BASE}[b];"
          "[1:v]format=rgba,fade=t=in:st=0.7:d=0.35:alpha=1[a1];"
          "[b][a1]overlay[b1];"
          "[2:v]format=rgba,fade=t=in:st=1.5:d=0.3:alpha=1[a2];"
          "[b1][a2]overlay[b2];"
          "[3:v]format=rgba,fade=t=in:st=2.0:d=0.45:alpha=1[t];"
          "[b2][t]overlay,setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def brand(name, dur=6.2):
    cmd = ["ffmpeg", "-v", "error",
           "-f", "lavfi", "-t", str(dur), "-i",
           f"color=c=0x07090c:s=1920x1080:r={FPS}",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/stage_bg.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/hero.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/wordmark.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/tagline.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U5}/micro.png"]
    fc = ("[1:v]format=rgba,fade=t=in:st=0:d=0.4:alpha=1,"
          "fade=t=out:st=1.5:d=0.5:alpha=1[bgf];"
          "[2:v]format=rgba,fade=t=in:st=0.1:d=0.4:alpha=1,"
          "fade=t=out:st=1.5:d=0.5:alpha=1[g];"
          "[0:v][bgf]overlay[z];[z][g]overlay[a];"
          "[3:v]format=rgba,fade=t=in:st=2.3:d=0.8:alpha=1[w];"
          "[4:v]format=rgba,fade=t=in:st=3.7:d=0.7:alpha=1[t];"
          "[5:v]format=rgba,fade=t=in:st=4.7:d=0.6:alpha=1[m];"
          "[a][w]overlay[b];[b][t]overlay[c];[c][m]overlay,"
          f"fade=t=out:st={dur - 0.9}:d=0.9,setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


SHOTS = ["s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "s09",
         "s10", "s11", "s12"]


def build_video():
    os.makedirs("trailer/out5", exist_ok=True)
    shot("s01", "raw/IMG_6682.MOV", 17.5, 4.4, zoom=1.05, fade_in=0.55,
         overlays=[(f"{U5}/hook.png", 1.0, 3.2)])
    shot("s02", "raw/IMG_6796.MOV", 44.5, 4.0, zoom=1.03,
         overlays=[(f"{U5}/mill_dot.png", 1.3, None)], fade_out=0.35)
    product("s03")
    zone("s04")
    shot("s05", "raw/IMG_6804.MOV", 23.5, 3.4, seq=f"{SEQ}/v5_dak_a",
         overlays=[(f"{U5}/era_dakota.png", 1.9, None)])
    shot("s06", "raw/IMG_6808.MOV", 25.6, 2.8, crop=(250, 300, 1470, 986),
         slow=1.4, seq=f"{SEQ}/v5_dak_b")
    shot("s07", "raw/IMG_6805.MOV", 27.5, 3.2, crop=(700, 300, 1920, 986),
         seq=f"{SEQ}/v5_set_a",
         overlays=[(f"{U5}/era_settle.png", 1.7, None)])
    shot("s08", "raw/IMG_6805.MOV", 31.9, 2.8, crop=(768, 336, 1920, 984),
         seq=f"{SEQ}/v5_set_b")
    ice("s09")
    sync("s10")
    shot("s11", "raw/IMG_6799.MOV", 1.0, 4.0, zoom=1.045, fade_out=0.5,
         overlays=[(f"{U5}/release.png", 1.2, None)])
    brand("s12")
    with open("trailer/out5/concat.txt", "w") as f:
        for s in SHOTS:
            f.write(f"file '{s}.mp4'\n")
    run(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", "trailer/out5/concat.txt", "-c", "copy",
         "trailer/out5/video.mp4", "-y"])
    print("concat done")


TOTAL = 53.2
CUES = [
    (f"{AU}/score.wav", 0.0, 0.68, TOTAL),
    (f"{AU}/x01.mp3", 0.5, 1.0, None),
    (f"{AU}/x02.mp3", 4.7, 1.0, None),
    (f"{AU}/x03.mp3", 8.9, 1.0, None),
    (f"{AU}/x04.mp3", 14.9, 1.0, None),
    (f"{AU}/x05.mp3", 20.3, 1.0, None),
    (f"{AU}/x06.mp3", 25.6, 1.0, None),
    (f"{AU}/x07.mp3", 36.8, 1.0, None),
    (f"{AU}/x08.mp3", 39.9, 1.0, None),
    (f"{AU}/x09.mp3", 43.3, 1.0, None),
    (f"{AU}/x10.mp3", 49.7, 1.0, None),
    (f"{AU}/amb_falls.wav", 0.0, 0.9, 4.8),
    (f"{AU}/amb_park.wav", 4.4, 0.5, 4.4),
    (f"{AU}/amb_park.wav", 14.6, 0.45, 16.4),
    (f"{AU}/fire.wav", 28.2, 0.4, 2.8),
    (f"{AU}/amb_falls.wav", 31.0, 0.55, 3.4),
    (f"{AU}/wind.wav", 33.5, 0.55, 5.7),
    (f"{AU}/creak.wav", 34.3, 0.6, None),
    (f"{AU}/rumble.wav", 36.2, 0.5, None),
    (f"{AU}/amb_falls.wav", 39.2, 0.5, 3.8),
    (f"{AU}/amb_falls.wav", 43.0, 0.4, 4.0),
    (f"{AU}/scan.wav", 19.05, 0.85, None),
    (f"{AU}/scan.wav", 22.45, 0.6, None),
    (f"{AU}/scan.wav", 25.9, 0.7, None),
    (f"{AU}/scan.wav", 28.45, 0.5, None),
    (f"{AU}/tick.wav", 15.75, 0.55, None),
    (f"{AU}/tick.wav", 40.6, 0.45, None),
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
              f"afade=t=out:st={TOTAL - 1.3}:d=1.3,"
              "loudnorm=I=-15:TP=-1.5:LRA=11[out]")
    run(["ffmpeg", "-v", "error"] + inputs +
        ["-filter_complex", ";".join(fc), "-map", "[out]", "-ar", "44100",
         "trailer/out5/mix.wav", "-y"])
    print("audio mixed")


def mux():
    run(["ffmpeg", "-v", "error", "-i", "trailer/out5/video.mp4",
         "-i", "trailer/out5/mix.wav", "-c:v", "copy", "-c:a", "aac",
         "-b:a", "224k", "-shortest", "-movflags", "+faststart",
         "out/ORI_trailer_pitch_v5_master.mp4", "-y"])
    print("muxed")


if __name__ == "__main__":
    build_video()
    build_audio()
    mux()
