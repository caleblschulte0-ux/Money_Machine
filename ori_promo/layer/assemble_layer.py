#!/usr/bin/env python3
"""v37 "THE WORLD / THE LAYER" -- concat, sound, master.

Narration only -- no score, no sound effects. r184's brief doesn't ask
for one; adding invented sound design without that being asked for would
be scope creep, the same judgment call every prior style in this slate
has made when not explicitly asked otherwise.
"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_layer import SECTIONS, FPS, TOTAL

OUT = "out_layer"
SR = 48000


def master(dst):
    with open("concat_layer.txt", "w") as fh:
        for s, st, d, desc in SECTIONS:
            fh.write(f"file '{os.path.abspath(OUT)}/{s}_t.mp4'\n")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", "concat_layer.txt", "-r", str(FPS), "-fps_mode", "cfr",
                    "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p",
                    f"{OUT}/_picture.mp4"], check=True)
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", f"{OUT}/_picture.mp4",
                        "-i", f"{OUT}/_vo.wav", "-filter_complex",
                        "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]",
                        "-map", "[a]", "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"\{[^{}]*input_i[^{}]*\}", p.stderr, re.S)
    if not m:
        sys.exit(p.stderr[-2000:])
    j = json.loads(m[-1])
    print("  measured", j["input_i"], j["input_tp"])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{OUT}/_picture.mp4",
                    "-i", f"{OUT}/_vo.wav", "-filter_complex",
                    (f"[1:a]loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:measured_I={j['input_i']}:"
                     f"measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
                     f"measured_thresh={j['input_thresh']},aresample={SR}[a]"),
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-ar", str(SR), "-movflags", "+faststart", dst], check=True)


if __name__ == "__main__":
    import vo_layer
    vo_layer.main()
    print("  sound")
    os.makedirs("../out", exist_ok=True)
    master("../out/ORI_WorldLayer_master.mp4")
    print("  mastered")
