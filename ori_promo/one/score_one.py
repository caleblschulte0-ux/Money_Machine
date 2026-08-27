#!/usr/bin/env python3
"""Score for "WHAT THIS PLACE WAS". Built to the beats, not looped under them.

Adapted from synth_music.py, which produced one flat 46s loop. A flat bed
is worse than none here: the film's whole shape is four eras arriving and
leaving, and a pad that ignores them tells the viewer nothing is happening.

This follows the cut, and every boundary is read out of spec_one so the
score cannot drift from the edit:

  montage     almost nothing. the location audio carries the place
  arrive      the system comes up
  first era   the lift. this is the one full AR reveal and it earns it
  second era  held, warm, no new event -- the era swapped on the cut
  ice         the pad thins to its top two voices and the sub drops out.
              cold is an ABSENCE of low end, not an added effect
  return      the low end comes back with the colour, then resolves

Everything is synthesized here -- no sample is loaded, nothing is licensed,
and it can be regenerated from source at any length.
"""
import os
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_one import BEATS, SCORE, TOTAL

SR = 48000                      # matches the master; 44.1k would resample
BPM = 88
BEAT = 60.0 / BPM
BAR = BEAT * 4

# A minor, F, C, G -- the same progression as synth_music.py
CHORDS = [
    [220.00, 261.63, 329.63],
    [174.61, 220.00, 261.63],
    [130.81, 164.81, 196.00, 261.63],
    [196.00, 246.94, 293.66],
]


def beat_at(name):
    for b, clip, tin, st, d, note in BEATS:
        if b == name:
            return st, d
    raise KeyError(name)


def adsr(n, a, r):
    env = np.ones(n)
    an, rn = min(int(a * SR), n // 2), min(int(r * SR), n // 2)
    if an:
        env[:an] = np.linspace(0, 1, an)
    if rn:
        env[-rn:] *= np.linspace(1, 0, rn)
    return env


def ramp(t, t0, t1, lo, hi):
    """Smooth lo->hi across [t0,t1], clamped outside."""
    u = np.clip((t - t0) / max(1e-6, t1 - t0), 0.0, 1.0)
    u = u * u * (3 - 2 * u)
    return lo + (hi - lo) * u


def main():
    n = int(TOTAL * SR)
    t = np.arange(n) / SR
    out = np.zeros(n, np.float32)

    # EVERY MILESTONE IS LOOKED UP BY ROLE, not by beat name. v3 read
    # "b1".."b4" directly; v4 renamed the beats and cut a montage in front
    # of them, and a score that hardcodes names either raises (fine) or --
    # worse, if a name happens to survive -- keeps playing the old edit
    # under the new one. spec_one.SCORE maps role -> beat and asserts the
    # beat exists at import.
    m_st, _ = beat_at(SCORE["start"])
    arr, _ = beat_at(SCORE["arrive"])
    e1, _ = beat_at(SCORE["lift"])
    e2, _ = beat_at(SCORE["hold"])
    ice_st, ice_d = beat_at(SCORE["cold"])
    ret_st, ret_d = beat_at(SCORE["warm"])

    # ---- the arc, as one gain curve read off the cut
    # The montage is the quietest thing in the film ON PURPOSE. It is real
    # footage of a real park and the location audio (falls, wind, footsteps)
    # carries it; a score that comes in over the waterfall at full weight
    # is the score telling you what to feel before anything has happened.
    gain = np.full(n, 0.22, np.float32)
    gain = np.where(t < arr, ramp(t, m_st, arr, 0.07, 0.26), gain)
    gain = np.where((t >= arr) & (t < e1), ramp(t, arr, e1, 0.26, 0.34), gain)
    gain = np.where((t >= e1) & (t < e2), ramp(t, e1, e1 + 2.0, 0.34, 0.80), gain)
    gain = np.where((t >= e2) & (t < ice_st), 0.80, gain)
    gain = np.where((t >= ice_st) & (t < ret_st),
                    ramp(t, ice_st, ice_st + 1.6, 0.80, 0.52), gain)
    gain = np.where(t >= ret_st, ramp(t, ret_st, ret_st + 2.0, 0.52, 0.86), gain)
    # let it go at the very end
    gain *= np.clip((TOTAL - 0.6 - t) / 2.4, 0.0, 1.0)

    # COLD = the low voices leaving. Under the ice the chord keeps only its
    # top two notes, which is what makes it read as thin rather than dark.
    cold = np.clip((t - ice_st) / 1.4, 0, 1) * (t < ret_st) \
        + np.clip(1.0 - (t - ret_st) / 1.6, 0, 1) * (t >= ret_st)
    cold = np.clip(cold, 0, 1)

    # ---- pads
    pos, bar_i = 0.0, 0
    rng = np.random.default_rng(7)
    while pos < TOTAL:
        chord = CHORDS[bar_i % len(CHORDS)]
        ln = int(min(BAR + 0.7, TOTAL - pos) * SR)
        if ln <= 0:
            break
        tt = np.arange(ln) / SR
        i0 = int(pos * SR)
        c_here = float(np.mean(cold[i0:i0 + ln])) if i0 < n else 0.0
        seg = np.zeros(ln)
        for vi, f in enumerate(sorted(chord)):
            # lowest voices fade out as `cold` rises
            voice = 1.0 if vi >= len(chord) - 2 else (1.0 - c_here)
            if voice <= 0.01:
                continue
            for det in (-0.16, 0.0, 0.16):
                for h in range(1, 6):
                    seg += voice * (0.9 ** h / h) * np.sin(
                        2 * np.pi * (f + det) * h * tt + rng.random() * 6.28)
        seg *= adsr(ln, 0.9, 1.3) * 0.026
        out[i0:i0 + ln] += seg[:n - i0]
        pos += BAR
        bar_i += 1

    # ---- sub pulse, absent under the ice
    pos = 0.0
    while pos < TOTAL - 0.5:
        ln = int(0.44 * SR)
        i0 = int(pos * SR)
        if i0 + ln > n:
            break
        root = CHORDS[int(pos / BAR) % len(CHORDS)][0] / 4
        tt = np.arange(ln) / SR
        amt = 1.0 - float(np.mean(cold[i0:i0 + ln]))
        if amt > 0.02:
            out[i0:i0 + ln] += (np.sin(2 * np.pi * root * tt)
                                * adsr(ln, 0.012, 0.32) * 0.15 * amt)
        pos += BEAT * 2

    # ---- air, and it gets BRIGHTER under the ice: wind, not warmth
    noise = np.convolve(rng.standard_normal(n), np.ones(200) / 200, mode="same")
    breathe = 0.5 + 0.5 * np.sin(2 * np.pi * t / 9.0)
    out += noise * breathe * (0.016 + 0.030 * cold)

    out *= gain
    peak = float(np.abs(out).max())
    if peak > 0:
        out /= peak * 1.12

    os.makedirs("out1", exist_ok=True)
    pcm = (np.clip(out, -1, 1) * 32767 * 0.72).astype(np.int16)
    with wave.open("out1/_music.wav", "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())
    print(f"  score: {TOTAL:.1f}s, montage under {m_st:.1f}-{arr:.1f}s, "
          f"lift at {e1:.1f}s, thin at {ice_st:.1f}s, resolve at {ret_st:.1f}s")


if __name__ == "__main__":
    main()
