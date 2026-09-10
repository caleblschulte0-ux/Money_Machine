#!/usr/bin/env python3
"""v36 "HOW THE SYSTEM WORKS" -- concat, sound, master.

Narration only -- no score, no sound effects. r178's brief doesn't ask
for a score or interface sound design the way r174 explicitly asked for
natural location sound in v35; adding invented "system" sound effects
(connection pings, UI ticks) without that being asked for would be scope
creep on a brief that's otherwise very precise about what it wants.
Flagged as an easy, optional addition in the round report if the
operator/ChatGPT wants one on a later pass.
"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_map import SECTIONS, FPS, TOTAL

OUT = "out_map"
SR = 48000


def master(dst):
    with open("concat_map.txt", "w") as fh:
        for s, st, d, desc in SECTIONS:
            fh.write(f"file '{os.path.abspath(OUT)}/{s}_t.mp4'\n")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", "concat_map.txt", "-r", str(FPS), "-fps_mode", "cfr",
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
    import vo_map
    vo_map.main()
    print("  sound")
    os.makedirs("../out", exist_ok=True)
    master("../out/ORI_SystemMap_master.mp4")
    print("  mastered")
