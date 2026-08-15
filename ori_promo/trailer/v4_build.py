#!/usr/bin/env python3
"""ORI pitch trailer v4 — 65.8s. Photoreal park, unified reconstruction
layer, depth-front activation, cinematic reframes, minimal confident UI."""
import subprocess
import sys
import os

FPS = 30
U4 = "trailer/ui4"
UI = "trailer/ui"
SEQ = "trailer/seq"
AU = "trailer/audio"

BASE = ("curves=m='0/0 0.07/0.05 0.5/0.49 0.87/0.83 1/0.95',"
        "eq=saturation=0.96:contrast=1.06:brightness=-0.012,"
        "colorbalance=rm=.03:gm=.01,noise=alls=3:allf=t")
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
    return f"trailer/out4/{name}.mp4"


def shot(name, src, ss, dur, overlays=(), crop=None, zoom=None,
         fade_in=0.0, fade_out=0.0, seq=None, slow=1.0):
    """overlays: (png, t_in, t_out|None). seq: dir of overlay frames."""
    cmd = ["ffmpeg", "-v", "error", "-ss", str(ss), "-t", str(dur / slow),
           "-i", src]
    if seq:
        cmd += ["-framerate", str(FPS), "-i", f"{seq}/%04d.png"]
    for png, _, _ in overlays:
        cmd += ["-loop", "1", "-t", str(dur), "-i", png]
    pre = "crop=%d:%d:%d:%d," % (crop[2] - crop[0], crop[3] - crop[1],
                                 crop[0], crop[1]) if crop else ""
    if slow != 1.0:
        pre += f"setpts={slow}*PTS,"
    parts = [f"[0:v]{pre}scale=1920:1080:force_original_aspect_ratio=increase,"
             f"crop=1920:1080,fps={FPS},{BASE}" +
             (("," + push(zoom, dur)) if zoom else "") + "[b0]"]
    cur = "b0"
    idx = 1
    if seq:
        parts.append(f"[{idx}:v]format=rgba[sq]")
        parts.append(f"[{cur}][sq]overlay=0:0[b1]")
        cur = "b1"
        idx += 1
    for i, (png, t_in, t_out) in enumerate(overlays):
        f = f"[{idx}:v]format=rgba,fade=t=in:st={t_in}:d=0.5:alpha=1"
        if t_out:
            f += f",fade=t=out:st={t_out}:d=0.45:alpha=1"
        parts.append(f + f"[o{i}]")
        parts.append(f"[{cur}][o{i}]overlay=0:0[c{i}]")
        cur = f"c{i}"
        idx += 1
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


def product(name, dur=7.0):
    L = [f"{UI}/glasses_plate.png", f"{U4}/prod_title.png",
         f"{U4}/prod_c1.png", f"{U4}/prod_c2.png", f"{U4}/prod_c3.png"]
    cmd = ["ffmpeg", "-v", "error",
           "-loop", "1", "-t", str(dur), "-i", f"{UI}/product_bg.png"]
    for p in L:
        cmd += ["-loop", "1", "-t", str(dur), "-i", p]
    co = 5.4
    fc = (f"[0:v]fps={FPS},scale=1920:1080,eq=brightness=-0.02[bg];"
          "[1:v]format=rgba,fade=t=in:st=0.5:d=0.9:alpha=1[hero];"
          "[2:v]format=rgba,fade=t=in:st=1.7:d=0.5:alpha=1[tt];"
          f"[3:v]format=rgba,fade=t=in:st=2.4:d=0.4:alpha=1,"
          f"fade=t=out:st={co}:d=0.45:alpha=1[c1];"
          f"[4:v]format=rgba,fade=t=in:st=3.1:d=0.4:alpha=1,"
          f"fade=t=out:st={co}:d=0.45:alpha=1[c2];"
          f"[5:v]format=rgba,fade=t=in:st=3.8:d=0.4:alpha=1,"
          f"fade=t=out:st={co}:d=0.45:alpha=1[c3];"
          "[bg][hero]overlay=0:y='6-4*min(t/1.4,1)'[a];[a][tt]overlay[b];"
          "[b][c1]overlay[c];[c][c2]overlay[d];[d][c3]overlay[e];"
          f"[e]fade=t=in:st=0:d=0.45,fade=t=out:st={dur - 0.4}:d=0.4,"
          + push(1.02, dur) + ",setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def zone(name, dur=5.2):
    cmd = ["ffmpeg", "-v", "error",
           "-ss", "41.2", "-t", str(dur), "-i", "raw/IMG_6805.MOV",
           "-loop", "1", "-t", str(dur), "-i", f"{U4}/zone_ring.png",
           "-framerate", str(FPS), "-i", f"{UI}/ring/%04d.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U4}/zone_t1.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U4}/zone_t2.png"]
    fc = ("[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
          f"crop=1920:1080,fps={FPS},{BASE}[b];"
          "[1:v]format=rgba,fade=t=in:st=1.5:d=0.5:alpha=1[z];"
          "[b][z]overlay[b1];"
          "[2:v]format=rgba,setpts=PTS+1.35/TB[r];"
          "[b1][r]overlay=0:0:enable='between(t,1.35,2.3)'[b2];"
          "[3:v]format=rgba,fade=t=in:st=1.7:d=0.4:alpha=1,"
          "fade=t=out:st=3.1:d=0.35:alpha=1[t1];[b2][t1]overlay[b3];"
          "[4:v]format=rgba,fade=t=in:st=3.4:d=0.4:alpha=1[t2];"
          "[b3][t2]overlay,setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def ice(name, dur=8.6):
    cmd = ["ffmpeg", "-v", "error",
           "-ss", "24.0", "-t", str(dur), "-i", "raw/IMG_6682.MOV",
           "-loop", "1", "-t", str(dur), "-i", "work/ice_base.png",
           "-stream_loop", "-1", "-t", str(dur), "-i", "work/snow.mp4",
           "-framerate", str(FPS), "-i", f"{SEQ}/v4_ice/%04d.png",
           "-loop", "1", "-t", str(dur), "-i", f"{UI}/haze.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U4}/lbl_ice.png"]
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
        "[5:v]format=rgba,fade=t=in:st=6.4:d=0.5:alpha=1[era];"
        "[x][era]overlay," + push(1.035, dur) + ",setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def sync(name, dur=4.6):
    cmd = ["ffmpeg", "-v", "error",
           "-ss", "40.5", "-t", str(dur), "-i", "raw/IMG_6806.MOV",
           "-loop", "1", "-t", str(dur), "-i", f"{U4}/sync_a.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U4}/sync_b.png",
           "-framerate", str(FPS), "-i", "trailer/ui4/pulse/%04d.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U4}/sync_title.png"]
    fc = ("[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
          f"crop=1920:1080,fps={FPS},{BASE}[b];"
          "[1:v]format=rgba,fade=t=in:st=0.9:d=0.4:alpha=1[a1];[b][a1]overlay[b1];"
          "[2:v]format=rgba,fade=t=in:st=1.7:d=0.4:alpha=1[a2];[b1][a2]overlay[b2];"
          "[3:v]format=rgba,setpts=PTS+2.1/TB[p];"
          "[b2][p]overlay=0:0:enable='between(t,2.1,2.9)'[b3];"
          "[4:v]format=rgba,fade=t=in:st=2.5:d=0.5:alpha=1[tt];"
          "[b3][tt]overlay,setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def map_shot(name, dur=4.4):
    cmd = ["ffmpeg", "-v", "error",
           "-framerate", str(FPS), "-i", f"{U4}/map/%04d.png",
           "-t", str(dur)]
    fc = (f"fps={FPS},fade=t=in:st=0:d=0.4,fade=t=out:st={dur - 0.4}:d=0.4,"
          "setsar=1,format=yuv420p")
    cmd += ["-vf", fc, "-an", "-c:v", "libx264", "-preset", "medium",
            "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


def brand(name, dur=6.8):
    cmd = ["ffmpeg", "-v", "error",
           "-f", "lavfi", "-t", str(dur), "-i",
           f"color=c=0x040507:s=1920x1080:r={FPS}",
           "-loop", "1", "-t", str(dur), "-i", f"{UI}/glasses_plate.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U4}/wordmark.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U4}/tagline.png",
           "-loop", "1", "-t", str(dur), "-i", f"{U4}/micro.png"]
    fc = ("[1:v]format=rgba,scale=1152:-1,fade=t=in:st=0.1:d=0.5:alpha=1,"
          "fade=t=out:st=1.6:d=0.5:alpha=1[g];"
          "[0:v][g]overlay=x=(W-w)/2:y=(H-h)/2-40[a];"
          "[2:v]format=rgba,fade=t=in:st=2.5:d=0.9:alpha=1[w];"
          "[3:v]format=rgba,fade=t=in:st=4.0:d=0.8:alpha=1[t];"
          "[4:v]format=rgba,fade=t=in:st=5.2:d=0.6:alpha=1[m];"
          "[a][w]overlay[b];[b][t]overlay[c];[c][m]overlay,"
          f"fade=t=out:st={dur - 1.0}:d=1.0,setsar=1,format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "17", O(name), "-y"]
    run(cmd)
    print("shot", name)


SHOTS = ["s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "s09",
         "s10", "s11", "s12"]


def build_video():
    os.makedirs("trailer/out4", exist_ok=True)
    shot("s01", "raw/IMG_6682.MOV", 17.5, 5.0, zoom=1.05, fade_in=0.6,
         overlays=[(f"{U4}/hook.png", 0.7, 4.3)])
    shot("s02", "raw/IMG_6796.MOV", 44.5, 5.4, zoom=1.03,
         overlays=[(f"{U4}/anchor_mill.png", 1.2, None)], fade_out=0.4)
    product("s03")
    zone("s04")
    shot("s05", "raw/IMG_6808.MOV", 25.6, 6.4, crop=(700, 380, 1920, 1066),
         seq=f"{SEQ}/v4_dakota", slow=2.0,
         overlays=[(f"{U4}/lbl_dakota.png", 3.4, None)])
    shot("s06", "raw/IMG_6805.MOV", 27.0, 4.2, seq=f"{SEQ}/v4_settle_a",
         overlays=[(f"{U4}/lbl_settle.png", 2.6, None)])
    shot("s07", "raw/IMG_6805.MOV", 31.5, 4.0, crop=(470, 260, 1920, 1076),
         seq=f"{SEQ}/v4_settle_b")
    ice("s08")
    sync("s09")
    map_shot("s10")
    shot("s11", "raw/IMG_6799.MOV", 1.0, 4.2, zoom=1.04, fade_out=0.5,
         overlays=[(f"{U4}/rel_1.png", 0.7, 2.0), (f"{U4}/rel_2.png", 2.3, None)])
    brand("s12")
    with open("trailer/out4/concat.txt", "w") as f:
        for s in SHOTS:
            f.write(f"file '{s}.mp4'\n")
    run(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", "trailer/out4/concat.txt", "-c", "copy",
         "trailer/out4/video.mp4", "-y"])
    print("concat done")


TOTAL = 65.8
CUES = [
    (f"{AU}/score.wav", 0.0, 0.7, TOTAL),
    (f"{AU}/w01.mp3", 0.6, 1.0, None),
    (f"{AU}/w02.mp3", 5.3, 1.0, None),
    (f"{AU}/w03.mp3", 11.0, 1.0, None),
    (f"{AU}/w04.mp3", 18.4, 1.0, None),
    (f"{AU}/w05.mp3", 24.2, 1.0, None),
    (f"{AU}/w06.mp3", 30.2, 1.0, None),
    (f"{AU}/w07.mp3", 43.0, 1.0, None),
    (f"{AU}/w08.mp3", 46.8, 1.0, None),
    (f"{AU}/w09.mp3", 50.9, 1.0, None),
    (f"{AU}/w10.mp3", 61.4, 1.0, None),
    (f"{AU}/amb_falls.wav", 0.0, 0.85, 5.4),
    (f"{AU}/amb_park.wav", 5.0, 0.5, 5.8),
    (f"{AU}/amb_park.wav", 17.4, 0.42, 20.0),
    (f"{AU}/amb_falls.wav", 37.2, 0.55, 4.4),
    (f"{AU}/wind.wav", 40.0, 0.55, 6.0),
    (f"{AU}/fire.wav", 33.2, 0.5, 4.2),
    (f"{AU}/rumble.wav", 42.0, 0.75, None),
    (f"{AU}/amb_falls.wav", 45.8, 0.5, 4.6),
    (f"{AU}/amb_falls.wav", 54.8, 0.38, 4.2),
    (f"{AU}/scan.wav", 23.4, 0.9, None),
    (f"{AU}/scan.wav", 29.7, 0.7, None),
    (f"{AU}/scan.wav", 33.4, 0.55, None),
    (f"{AU}/scan.wav", 41.9, 0.7, None),
    (f"{AU}/tick.wav", 18.75, 0.6, None),
    (f"{AU}/tick.wav", 47.6, 0.45, None),
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
         "trailer/out4/mix.wav", "-y"])
    print("audio mixed")


def mux():
    run(["ffmpeg", "-v", "error", "-i", "trailer/out4/video.mp4",
         "-i", "trailer/out4/mix.wav", "-c:v", "copy", "-c:a", "aac",
         "-b:a", "224k", "-shortest", "-movflags", "+faststart",
         "out/ORI_trailer_pitch_v4_master.mp4", "-y"])
    print("muxed")


if __name__ == "__main__":
    build_video()
    build_audio()
    mux()
