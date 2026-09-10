#!/usr/bin/env python3
"""v35 "THE WALKTHROUGH" -- natural location sound, not a synthesized
score. r174's brief: "footsteps, water, wind, fabric movement, and short
real-location sound bridges should make the route feel physically
present" and specifically "two seconds of location sound before
narration settles in" (open) plus "one or two location-sound accents
bridge the cuts" (elsewhere). v33/v34 both cut location audio entirely,
on a standing operator note: "there's a lot of me talking in the
background because there wasn't meant to be sound in the videos." v35
still needs SOME real location sound to be genuinely "natural, immediate,
human scale" per this specific brief, so this stays deliberately narrow:

  - short (<=1.8s) snippets only, at exactly the in-points already
    chosen for picture (so sound and image match)
  - a highpass (300Hz) applied, which does two things at once: pushes
    the mix toward the broadband texture (footsteps/water/wind) the
    brief actually asks for, and reduces the intelligibility of any
    faint background speech at distance (voices lose their low body)
  - mixed LOW (peak ~0.12 pre-limiter) and only in gaps where no VO line
    is playing -- these are accents, not an open mic under the film
  - Nobody has listened to these snippets by ear to confirm they carry
    no audible dialogue (this session has no audio playback capability).
    Flagged plainly in the round report as a judgment call under the
    standing note above, not silently assumed safe.
"""
import subprocess

SR = 48000
RAW = "../raw"


def extract_snippet(clip, tin, dur, sr=SR):
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{tin}", "-i", f"{RAW}/IMG_{clip}.MOV",
         "-t", f"{dur}", "-af", "highpass=f=300,afade=t=in:d=0.15,afade=t=out:st="
         f"{max(0.0, dur - 0.15):.3f}:d=0.15",
         "-ac", "2", "-ar", str(sr), "-f", "s16le", "-"],
        capture_output=True)
    if r.returncode != 0 or len(r.stdout) == 0:
        raise SystemExit(f"natural_sound {clip}@{tin}: {r.stderr.decode()[-500:]}")
    import numpy as np
    a = np.frombuffer(r.stdout, np.int16).astype(np.float32) / 32768.0
    a = a.reshape(-1, 2)
    peak = float(np.abs(a).max())
    if peak > 0:
        a = a * (0.12 / peak)
    return a
