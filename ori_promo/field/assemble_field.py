#!/usr/bin/env python3
"""v34 "THE FIELD GUIDE" -- concat, sound, master.

Adapted from one/assemble_one.py, trimmed to what this style actually
needs: no end_card() (build_close() already builds its own held-frame
title card inside render_field.py) and no marks() (this style has no
tracked AR-recognition reticle -- map_zone_marker is a static drawn ring,
not a locking confirmation, so there is no "lock" event to sonify).
Two sources only: score, narration.
"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_field import BEATS, FPS

OUT = "out_field"
SR = 48000


def master(dst):
    with open("concat_field.txt", "w") as fh:
        for b, st, d, desc in BEATS:
            fh.write(f"file '{os.path.abspath(OUT)}/{b}_t.mp4'\n")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", "concat_field.txt", "-r", str(FPS), "-fps_mode", "cfr",
                    "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p",
                    f"{OUT}/_picture.mp4"], check=True)
    mix = ("[1:a][2:a]amix=inputs=2:normalize=0:weights=0.55 1.0,"
           "alimiter=limit=0.80:attack=4:release=90:level=disabled")
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", f"{OUT}/_picture.mp4",
                        "-i", f"{OUT}/_music.wav", "-i", f"{OUT}/_vo.wav", "-filter_complex",
                        mix + ",loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]",
                        "-map", "[a]", "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"\{[^{}]*input_i[^{}]*\}", p.stderr, re.S)
    if not m:
        sys.exit(p.stderr[-2000:])
    j = json.loads(m[-1])
    print("  measured", j["input_i"], j["input_tp"])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{OUT}/_picture.mp4",
                    "-i", f"{OUT}/_music.wav", "-i", f"{OUT}/_vo.wav", "-filter_complex",
                    mix + (f",loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:measured_I={j['input_i']}:"
                           f"measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
                           f"measured_thresh={j['input_thresh']},aresample={SR}[a]"),
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-ar", str(SR), "-movflags", "+faststart", dst], check=True)


if __name__ == "__main__":
    import score_field
    score_field.main()
    import vo_field
    vo_field.main()
    print("  sound")
    os.makedirs("../out", exist_ok=True)
    master("../out/ORI_Field_Guide_master.mp4")
    print("  mastered")
