#!/usr/bin/env python3
"""Delivery QA for a finished master. Refuses to call something done on the
strength of it having been produced.

Checks the things that have actually gone wrong on this project:
  duration against the spec's stated total
  container: resolution, fps, audio sample rate (loudnorm runs at 192k
    internally and hands that rate downstream -- this is how Film A ended up
    with 96 kHz AAC)
  loudness and true peak, re-measured on the finished file
  blackdetect / freezedetect / silencedetect over the whole thing
"""
import json
import os
import re
import subprocess
import sys


def end_card_start(default=None):
    """Where the deliberate held end-card frame begins, read from the spec
    itself rather than guessed as a fixed offset from the total duration.

    v31 grew `end` from 3.5s to 4.5s (spec_one.py's BEATS) and that alone
    flipped this check from PASS to a false FAIL: freezedetect's onset
    inside a still hold depends on how long the moving grain takes to drop
    below its noise floor, not on the hold's length, so a longer hold can
    report an EARLIER freeze_start timestamp while remaining exactly as
    intentional. The old check excused anything in the last 3.0s
    (`dur - 3.0`) -- tuned against whatever `end` was worth when that
    number was written, silently wrong the moment `end` grew past 3.0s.
    Reading the beat's real start removes the guess.
    """
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "one"))
        from spec_one import BEATS
        for name, _clip, _tin, start, _dur, _note in BEATS:
            if name == "end":
                return start
    except Exception:
        pass
    return default


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                        "-of", "json", p], capture_output=True, text=True)
    return json.loads(r.stdout)


def main(path, want_dur=None):
    j = probe(path)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    a = next((s for s in j["streams"] if s["codec_type"] == "audio"), None)
    dur = float(j["format"]["duration"])
    print(f"{path}")
    print(f"  {v['width']}x{v['height']} {eval(v['r_frame_rate']):.3f} fps  "
          f"{dur:.3f}s  {int(j['format']['size'])/1e6:.1f} MB")
    if a:
        print(f"  audio {a['codec_name']} {a['sample_rate']} Hz {a['channels']} ch")
    bad = []
    if want_dur is not None and abs(dur - want_dur) > 0.05:
        bad.append(f"duration {dur:.3f} != {want_dur}")
    if a and int(a["sample_rate"]) != 48000:
        bad.append(f"sample rate {a['sample_rate']} (loudnorm leaked its internal rate)")

    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
                        "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"\{[^{}]*input_i[^{}]*\}", r.stderr, re.S)
    if m:
        d = json.loads(m[-1])
        print(f"  loudness {d['input_i']} LUFS   true peak {d['input_tp']} dBFS")
        if float(d["input_i"]) > -14.0 or float(d["input_i"]) < -19.0:
            bad.append(f"loudness {d['input_i']} outside -19..-14")
        if float(d["input_tp"]) > -0.8:
            bad.append(f"true peak {d['input_tp']} too hot")

    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vf",
                        "blackdetect=d=0.25:pic_th=0.98,"
                        "freezedetect=n=0.001:d=0.7", "-af", "silencedetect=n=-52dB:d=0.7",
                        "-f", "null", "-"], capture_output=True, text=True)
    # the held end card is a deliberate freeze; ignore anything inside it.
    # Read from spec_one.py's actual `end` beat start where possible, since
    # a fixed "last N seconds" guess goes stale the moment that beat's
    # duration changes (see end_card_start's docstring).
    excuse_from = end_card_start(default=dur - 3.0)
    for tag in ("black_start", "freeze_start", "silence_start"):
        hits = re.findall(tag + r":\s*([0-9.]+)", r.stderr)
        hits = [h for h in hits if float(h) < excuse_from]
        print(f"  {tag:14s} {len(hits)}  {hits[:4]}")
        if hits:
            bad.append(f"{tag} at {hits[:3]}")
    print("  VERDICT:", "PASS" if not bad else "FAIL -- " + "; ".join(bad))
    return 0 if not bad else 1


if __name__ == "__main__":
    want = float(sys.argv[2]) if len(sys.argv) > 2 else None
    sys.exit(main(sys.argv[1], want))
