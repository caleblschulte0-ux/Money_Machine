#!/usr/bin/env python3
"""V2 of five — INVESTOR TEASER, ~44s, 16:9.

Re-cut from the approved Demo v2 shot masters (trailer/out7/s*.mp4, which
are silent), with its own tighter narration. No new rendering, so every
frame is material ChatGPT already signed off on in r06.
"""
import os
import subprocess
import sys

FPS = 30
AU = "trailer/audio"
IN = "trailer/out7"
OUT = "trailer/out8"
U5, U7 = "trailer/ui5", "trailer/ui7"


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2000:])
        sys.exit("FAILED: " + " ".join(map(str, cmd[:8])))


# (source shot, in-point, duration)
CUTS = [
    ("s01", 0.0, 4.0),    # falls + HISTORY, WHERE IT HAPPENED.
    ("s05", 0.9, 3.5),    # experience zone traced on real terrain
    ("s06", 0.5, 4.4),    # Dakota reconstruction
    ("s08", 0.4, 3.0),    # settlement wagon behind real stones
    ("s10", 0.9, 4.8),    # ice age
    ("s11", 0.2, 4.2),    # product stage
    ("s13", 0.0, 2.6),    # worn close-up
    ("s15", 1.7, 3.8),    # two wearers, SEE IT TOGETHER
    ("s16", 0.3, 5.2),    # route map
    ("s17", 0.4, 3.8),    # ANY PLACE WITH A STORY
]
END = 5.0
TOTAL = sum(c[2] for c in CUTS) + END


def build_video():
    os.makedirs(OUT, exist_ok=True)
    names = []
    for i, (src, ss, dur) in enumerate(CUTS):
        out = f"{OUT}/c{i:02d}.mp4"
        run(["ffmpeg", "-v", "error", "-ss", str(ss), "-t", str(dur),
             "-i", f"{IN}/{src}.mp4", "-c:v", "libx264", "-preset", "medium",
             "-crf", "17", "-an", "-fps_mode", "cfr", "-r", str(FPS), out, "-y"])
        names.append(os.path.basename(out))
        print("cut", src, ss, dur)
    # end card: same consolidated card as the approved master
    run(["ffmpeg", "-v", "error", "-f", "lavfi", "-t", str(END),
         "-i", f"color=c=0x07090c:s=1920x1080:r={FPS}",
         "-loop", "1", "-t", str(END), "-i", f"{U7}/endcard.png",
         "-filter_complex",
         "[1:v]format=rgba,fade=t=in:st=0.2:d=0.6:alpha=1[c];"
         "[0:v][c]overlay,"
         f"fade=t=out:st={END - 0.8}:d=0.8,setsar=1,format=yuv420p[v]",
         "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "medium",
         "-crf", "17", f"{OUT}/c99.mp4", "-y"])
    names.append("c99.mp4")
    with open(f"{OUT}/concat.txt", "w") as f:
        for n in names:
            f.write(f"file '{n}'\n")
    run(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", f"{OUT}/concat.txt", "-c", "copy", f"{OUT}/video.mp4", "-y"])
    print("concat done", TOTAL)


CUES = [
    (f"{AU}/score_long.wav", 0.0, 0.66, TOTAL),
    (f"{AU}/z01.mp3", 0.6, 1.0, None),
    (f"{AU}/z02.mp3", 6.2, 1.0, None),
    (f"{AU}/z03.mp3", 23.0, 1.0, None),
    (f"{AU}/z04.mp3", 12.4, 1.0, None),
    (f"{AU}/z05.mp3", 33.6, 1.0, None),
    (f"{AU}/z06.mp3", 39.6, 1.0, None),
    (f"{AU}/amb_falls.wav", 0.0, 0.85, 4.0),
    (f"{AU}/amb_park.wav", 4.0, 0.5, 11.0),
    (f"{AU}/wind.wav", 15.8, 0.5, 4.6),
    (f"{AU}/rumble.wav", 16.6, 0.5, None),
    (f"{AU}/amb_park.wav", 29.8, 0.45, 9.2),
    (f"{AU}/amb_falls.wav", 39.0, 0.4, 3.8),
    (f"{AU}/scan.wav", 5.2, 0.8, None),
    (f"{AU}/scan.wav", 9.4, 0.75, None),
    (f"{AU}/scan.wav", 12.6, 0.6, None),
    (f"{AU}/tick.wav", 33.9, 0.5, None),
    (f"{AU}/tick.wav", 34.8, 0.45, None),
    (f"{AU}/tick.wav", 35.7, 0.45, None),
    (f"{AU}/shimmer.wav", 27.4, 0.4, None),
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
                    f"afade=t=in:d=0.4,afade=t=out:st={max(trim - 0.7, 0.1)}:d=0.7"]
        ops += [f"volume={g}", f"adelay={int(st * 1000)}|{int(st * 1000)}"]
        fc.append(f"[{i}:a]" + ",".join(ops) + f"[a{i}]")
        labels.append(f"[a{i}]")
    fc.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0,"
              f"afade=t=out:st={TOTAL - 1.2}:d=1.2,"
              "loudnorm=I=-15:TP=-1.5:LRA=11[out]")
    run(["ffmpeg", "-v", "error"] + inputs +
        ["-filter_complex", ";".join(fc), "-map", "[out]", "-ar", "44100",
         f"{OUT}/mix.wav", "-y"])
    print("audio mixed")


def mux():
    run(["ffmpeg", "-v", "error", "-i", f"{OUT}/video.mp4", "-i", f"{OUT}/mix.wav",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "224k", "-shortest",
         "-movflags", "+faststart", "out/ORI_V2_investor_teaser_master.mp4", "-y"])
    print("muxed")


if __name__ == "__main__":
    build_video()
    build_audio()
    mux()
