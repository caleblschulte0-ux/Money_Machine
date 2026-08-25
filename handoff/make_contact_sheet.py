#!/usr/bin/env python3
"""Turn an MP4 into review evidence for the AI_HANDOFF loop.

Produces, next to the input video:
  <name>__contact.png   timestamped frame grid (~1 frame / 1.5s, 6 across)
  <name>__timeline.txt  stub shot list with the sampled timestamps, to be
                        filled in by whoever made the cut

Only needs ffmpeg + ffprobe on PATH. Usage:
  python make_contact_sheet.py path/to/video.mp4 [--interval 1.5] [--cols 6]

Sampling is done with one explicit seek per tile. It used to be done with a
single `fps=1/interval,...,tile=` chain, which was much faster and WRONG: the
fps filter re-bases output timestamps, so each tile drifted later than the
label burned onto it — about +2s by the 40-second mark of a 100-second film,
and growing. Every timestamped review note written against those sheets was
aimed at the wrong frame. Correctness beats speed here; the whole point of
the sheet is that a partner who cannot open the MP4 can cite a timestamp and
have it mean something.
"""
import argparse
import math
import os
import subprocess
import sys

FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", path],
        capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def hms(t):
    h, rem = divmod(int(t), 3600)
    m, s = divmod(rem, 60)
    return f"{h:d}:{m:02d}:{s:02d}.{int(round((t % 1) * 10))}"


def font_path():
    for f in FONTS:
        if os.path.exists(f):
            return f
    return None


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
    try:
        from PIL import Image
    except ImportError:
        sys.exit("needs Pillow (pip install pillow)")

    dur = probe_duration(args.video)
    n = max(1, math.ceil(dur / args.interval))
    rows = math.ceil(n / args.cols)
    base = os.path.splitext(args.video)[0]
    sheet = f"{base}__contact.png"
    timeline = f"{base}__timeline.txt"
    tmpdir = f"{base}__tiles"
    os.makedirs(tmpdir, exist_ok=True)

    fp = font_path()
    tiles, stamped = [], fp is not None
    for i in range(n):
        t = min(i * args.interval, max(dur - 0.05, 0))
        out = os.path.join(tmpdir, f"{i:04d}.jpg")
        vf = f"scale={args.width}:-2"
        if fp:
            # label is the time we SEEKED to, not a filtered timestamp
            lbl = hms(t).replace(":", r"\:")
            vf += (f",drawtext=fontfile={fp}:text='{lbl}':fontcolor=white:"
                   f"fontsize=18:box=1:boxcolor=black@0.62:boxborderw=4:"
                   f"x=6:y=h-26")
        r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}",
                            "-i", args.video, "-frames:v", "1", "-vf", vf, out],
                           capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(out):
            if fp:      # ffmpeg without freetype: fall back to unstamped tiles
                fp, stamped = None, False
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}",
                                "-i", args.video, "-frames:v", "1", "-vf",
                                f"scale={args.width}:-2", out], check=True)
            else:
                sys.exit(r.stderr[-2000:])
        tiles.append(out)

    ims = [Image.open(p) for p in tiles]
    tw, th = ims[0].size
    grid = Image.new("RGB", (tw * args.cols, th * rows), (12, 12, 14))
    for i, im in enumerate(ims):
        if im.size != (tw, th):
            im = im.resize((tw, th))
        grid.paste(im, ((i % args.cols) * tw, (i // args.cols) * th))
    grid.save(sheet)
    for p in tiles:
        os.remove(p)
    os.rmdir(tmpdir)

    with open(timeline, "w") as f:
        f.write(f"# Timeline for {os.path.basename(args.video)}\n")
        f.write(f"# duration {dur:.1f}s — contact sheet: 1 frame per "
                f"{args.interval}s, {args.cols} per row, reading order "
                f"left-to-right then down"
                f"{'' if stamped else ' (tiles unstamped; use this list)'}\n")
        f.write("# Each tile is an exact seek to the time burned on it.\n")
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
