#!/usr/bin/env python3
"""Turn an MP4 into review evidence for the AI_HANDOFF loop.

Produces, next to the input video:
  <name>__contact.png   timestamped frame grid (~1 frame / 1.5s, 6 across)
  <name>__timeline.txt  stub shot list with the sampled timestamps, to be
                        filled in by whoever made the cut

Only needs ffmpeg + ffprobe on PATH. Usage:
  python make_contact_sheet.py path/to/video.mp4 [--interval 1.5] [--cols 6]
"""
import argparse
import math
import os
import subprocess
import sys


def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", path],
        capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--interval", type=float, default=1.5,
                    help="seconds between sampled frames")
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--width", type=int, default=320,
                    help="width of each tile in px")
    args = ap.parse_args()

    if not os.path.exists(args.video):
        sys.exit(f"not found: {args.video}")

    dur = probe_duration(args.video)
    n = max(1, math.ceil(dur / args.interval))
    rows = math.ceil(n / args.cols)
    base = os.path.splitext(args.video)[0]
    sheet = f"{base}__contact.png"
    timeline = f"{base}__timeline.txt"

    stamp = ("drawtext=text='%{pts\\:hms}':fontcolor=white:fontsize=20:"
             "box=1:boxcolor=black@0.55:boxborderw=4:x=8:y=h-30,")
    vf = (f"fps=1/{args.interval},scale={args.width}:-2,"
          f"{stamp}tile={args.cols}x{rows}")
    cmd = ["ffmpeg", "-y", "-i", args.video, "-vf", vf,
           "-frames:v", "1", sheet]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 and "drawtext" in r.stderr:
        # ffmpeg built without freetype: fall back to an unstamped grid
        vf = (f"fps=1/{args.interval},scale={args.width}:-2,"
              f"tile={args.cols}x{rows}")
        subprocess.run(["ffmpeg", "-y", "-i", args.video, "-vf", vf,
                        "-frames:v", "1", sheet], check=True)
        stamped = False
    elif r.returncode != 0:
        sys.exit(r.stderr[-2000:])
    else:
        stamped = True

    with open(timeline, "w") as f:
        f.write(f"# Timeline for {os.path.basename(args.video)}\n")
        f.write(f"# duration {dur:.1f}s — contact sheet: 1 frame per "
                f"{args.interval}s, {args.cols} per row, reading order "
                f"left-to-right then down"
                f"{'' if stamped else ' (tiles unstamped; use this list)'}\n")
        f.write("# Fill in: what is on screen + narration/text per span.\n\n")
        for i in range(n):
            t0 = i * args.interval
            t1 = min(dur, t0 + args.interval)
            f.write(f"{t0:6.1f}-{t1:6.1f}  [describe shot]  "
                    f"[narration/text on screen]\n")

    print(f"wrote {sheet}  ({args.cols}x{rows} grid, {n} frames, "
          f"{dur:.1f}s video)")
    print(f"wrote {timeline}  (stub — fill in before uploading)")


if __name__ == "__main__":
    main()
