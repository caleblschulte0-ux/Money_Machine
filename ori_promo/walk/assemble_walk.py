#!/usr/bin/env python3
"""v35 "THE WALKTHROUGH" -- concat, sound, master.

No score_walk.py -- this style's sound design is natural location sound
plus narration, not music (see natural_sound.py's header for why). Three
sources: narration, natural-sound accents, and that's it.
"""
import json
import os
import re
import subprocess
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_walk import BEATS, FPS, TOTAL
import natural_sound as NS

OUT = "out_walk"
SR = 48000

# (clip, tin, dur, at) -- at is FILM time the snippet starts playing.
# arrive's snippet fills the lead-in gap before its own VO line (offset
# 1.8s in spec_walk.py's VO_LINES); walk's and return's are short cut-in
# accents at each beat's own start, matching r174's "one or two accents
# bridge the cuts".
ACCENTS = [
    ("6790", 0.6, 1.7, 0.0),     # arrive: matches the beat's own footage in-point
    ("6805", 38.0, 1.0, 16.0),   # walk: cut-in accent
    ("6805", 48.0, 1.0, 54.0),   # return: cut-in accent
]


def build_natural_sound():
    n = int(TOTAL * SR)
    bus = np.zeros((n, 2), np.float32)
    for clip, tin, dur, at in ACCENTS:
        seg = NS.extract_snippet(clip, tin, dur)
        i0 = int(at * SR)
        end = min(n, i0 + len(seg))
        bus[i0:end] += seg[:end - i0]
    peak = float(np.abs(bus).max())
    if peak > 0.9:
        bus *= 0.9 / peak
    pcm = (np.clip(bus, -1, 1) * 32767).astype(np.int16)
    with wave.open(f"{OUT}/_natural.wav", "w") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"  natural sound: {len(ACCENTS)} accents placed")


def master(dst):
    with open("concat_walk.txt", "w") as fh:
        for b, st, d, desc in BEATS:
            fh.write(f"file '{os.path.abspath(OUT)}/{b}_t.mp4'\n")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", "concat_walk.txt", "-r", str(FPS), "-fps_mode", "cfr",
                    "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p",
                    f"{OUT}/_picture.mp4"], check=True)
    mix = ("[1:a][2:a]amix=inputs=2:normalize=0:weights=1.0 0.8,"
           "alimiter=limit=0.85:attack=4:release=90:level=disabled")
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", f"{OUT}/_picture.mp4",
                        "-i", f"{OUT}/_vo.wav", "-i", f"{OUT}/_natural.wav", "-filter_complex",
                        mix + ",loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]",
                        "-map", "[a]", "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"\{[^{}]*input_i[^{}]*\}", p.stderr, re.S)
    if not m:
        sys.exit(p.stderr[-2000:])
    j = json.loads(m[-1])
    print("  measured", j["input_i"], j["input_tp"])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{OUT}/_picture.mp4",
                    "-i", f"{OUT}/_vo.wav", "-i", f"{OUT}/_natural.wav", "-filter_complex",
                    mix + (f",loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:measured_I={j['input_i']}:"
                           f"measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
                           f"measured_thresh={j['input_thresh']},aresample={SR}[a]"),
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-ar", str(SR), "-movflags", "+faststart", dst], check=True)


if __name__ == "__main__":
    build_natural_sound()
    import vo_walk
    vo_walk.main()
    print("  sound")
    os.makedirs("../out", exist_ok=True)
    master("../out/ORI_Walkthrough_master.mp4")
    print("  mastered")
