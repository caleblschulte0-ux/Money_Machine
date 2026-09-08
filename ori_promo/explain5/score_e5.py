#!/usr/bin/env python3
"""Score for ORI Explainer #1 ("The Idea"). Adapted from one/score_one.py's
arc unchanged -- one rise, one release, matched to the glasses turning on
-- just re-read against this longer video's own beat boundaries (spec_e5)
so the score cannot drift from this edit. See one/score_one.py for the
full reasoning; nothing about the arc itself changed for this video.

Everything is synthesized here -- no sample is loaded, nothing is
licensed, and it can be regenerated from source at any length.
"""
import os
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_e5 import BEATS, SCORE, TOTAL

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

    # EVERY MILESTONE IS LOOKED UP BY ROLE, not by beat name -- same
    # discipline as before: spec_one.SCORE maps role -> beat and asserts
    # the beat exists at import, so a future spec rewrite either keeps
    # this in sync or fails loudly, never silently plays the old arc under
    # a new edit.
    m_st, _ = beat_at(SCORE["start"])
    lift_st, _ = beat_at(SCORE["lift"])
    peak_st, _ = beat_at(SCORE["peak"])
    rel_st, _ = beat_at(SCORE["release"])

    # ---- the arc, as one gain curve read off the cut. ONE rise, ONE
    # release -- no four-act structure, because there is no four-act film
    # underneath it any more.
    # The montage is the quietest thing in the film ON PURPOSE, same
    # reasoning kept from every version before this one: it is real
    # footage of a real park, there is no location audio under this master
    # (gone since v8, on the operator's instruction), and a score that
    # comes in hot over an ordinary park tells the viewer what to feel
    # before anything has happened.
    gain = np.full(n, 0.55, np.float32)
    gain = np.where(t < lift_st, ramp(t, m_st, lift_st, 0.12, 0.20), gain)
    gain = np.where((t >= lift_st) & (t < peak_st),
                    ramp(t, lift_st, peak_st, 0.20, 0.58), gain)
    gain = np.where((t >= peak_st) & (t < rel_st), 0.58, gain)
    gain = np.where(t >= rel_st, ramp(t, rel_st, rel_st + 2.2, 0.58, 0.30), gain)
    # let it go at the very end
    gain *= np.clip((TOTAL - 0.6 - t) / 2.4, 0.0, 1.0)

    # ---- pads. Every voice plays throughout -- there is no "cold" state
    # to thin them out for any more, so the chord simply carries the arc
    # via `gain` above rather than losing its own low end partway through.
    pos, bar_i = 0.0, 0
    rng = np.random.default_rng(7)
    while pos < TOTAL:
        chord = CHORDS[bar_i % len(CHORDS)]
        ln = int(min(BAR + 0.7, TOTAL - pos) * SR)
        if ln <= 0:
            break
        tt = np.arange(ln) / SR
        i0 = int(pos * SR)
        seg = np.zeros(ln)
        for f in sorted(chord):
            for det in (-0.16, 0.0, 0.16):
                for h in range(1, 6):
                    seg += (0.9 ** h / h) * np.sin(
                        2 * np.pi * (f + det) * h * tt + rng.random() * 6.28)
        seg *= adsr(ln, 0.9, 1.3) * 0.026
        out[i0:i0 + ln] += seg[:n - i0]
        pos += BAR
        bar_i += 1

    # ---- sub pulse, steady throughout -- same reasoning as the pads.
    pos = 0.0
    while pos < TOTAL - 0.5:
        ln = int(0.44 * SR)
        i0 = int(pos * SR)
        if i0 + ln > n:
            break
        root = CHORDS[int(pos / BAR) % len(CHORDS)][0] / 4
        tt = np.arange(ln) / SR
        out[i0:i0 + ln] += (np.sin(2 * np.pi * root * tt)
                            * adsr(ln, 0.012, 0.32) * 0.15)
        pos += BEAT * 2

    # ---- air: a constant, gentle breathing noise bed, not a weather
    # effect tied to a temperature that no longer exists in this film.
    noise = np.convolve(rng.standard_normal(n), np.ones(200) / 200, mode="same")
    breathe = 0.5 + 0.5 * np.sin(2 * np.pi * t / 9.0)
    out += noise * breathe * 0.018

    out *= gain
    peak = float(np.abs(out).max())
    if peak > 0:
        out /= peak * 1.12

    os.makedirs("out_e5", exist_ok=True)
    pcm = (np.clip(out, -1, 1) * 32767 * 0.72).astype(np.int16)
    with wave.open("out_e5/_music.wav", "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())
    print(f"  score: {TOTAL:.1f}s, quiet under {m_st:.1f}-{lift_st:.1f}s, "
          f"lift at {lift_st:.1f}s, peak at {peak_st:.1f}s, release at {rel_st:.1f}s")


if __name__ == "__main__":
    main()
