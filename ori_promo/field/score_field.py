#!/usr/bin/env python3
"""v34 "THE FIELD GUIDE" -- score.

Deliberately NOT v33's one-rise-one-release arc (score_one.py): that shape
is matched to a single emotional event (the glasses turning on) this style
doesn't stage as a reveal. r168's brief is "clean editorial rhythm" --
steady, quiet, mostly out of the way, present mainly so narration doesn't
sit over dead silence between beats. One gentle swell under `experience`
(the three examples, the closest thing this film has to a "this is the
capability" moment) is the only shaping; everywhere else the bed just
holds. Synthesized here, no sample, no license, regenerable from source.
"""
import os
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_field import BEATS, TOTAL

SR = 48000
BPM = 78
BEAT = 60.0 / BPM
BAR = BEAT * 4

# C, Am, F, G -- a plain, open progression; nothing minor-key/moody the
# way v33's A minor bed is (that film is elegiac, this one is a field guide)
CHORDS = [
    [130.81, 164.81, 196.00],
    [110.00, 130.81, 164.81],
    [87.31, 130.81, 174.61],
    [98.00, 146.83, 196.00],
]


def beat_at(name):
    for b, st, d, desc in BEATS:
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


def main():
    n = int(TOTAL * SR)
    t = np.arange(n) / SR
    out = np.zeros(n, np.float32)

    exp_st, exp_d = beat_at("experience")

    gain = np.full(n, 0.30, np.float32)
    gain = np.where((t >= exp_st) & (t < exp_st + exp_d), 0.40, gain)
    gain *= np.clip(t / 1.5, 0.0, 1.0)                       # fade in
    gain *= np.clip((TOTAL - 0.8 - t) / 2.0, 0.0, 1.0)        # fade out

    pos, bar_i = 0.0, 0
    rng = np.random.default_rng(11)
    while pos < TOTAL:
        chord = CHORDS[bar_i % len(CHORDS)]
        ln = int(min(BAR + 0.6, TOTAL - pos) * SR)
        if ln <= 0:
            break
        tt = np.arange(ln) / SR
        i0 = int(pos * SR)
        seg = np.zeros(ln)
        for f in sorted(chord):
            for h in range(1, 4):
                seg += (0.85 ** h / h) * np.sin(2 * np.pi * f * h * tt + rng.random() * 6.28)
        seg *= adsr(ln, 1.1, 1.4) * 0.030
        out[i0:i0 + ln] += seg[:n - i0]
        pos += BAR
        bar_i += 1

    noise = np.convolve(rng.standard_normal(n), np.ones(300) / 300, mode="same")
    breathe = 0.5 + 0.5 * np.sin(2 * np.pi * t / 11.0)
    out += noise * breathe * 0.012

    out *= gain
    peak = float(np.abs(out).max())
    if peak > 0:
        out /= peak * 1.15

    os.makedirs("out_field", exist_ok=True)
    pcm = (np.clip(out, -1, 1) * 32767 * 0.65).astype(np.int16)
    with wave.open("out_field/_music.wav", "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())
    print(f"  score: {TOTAL:.1f}s, steady bed, light swell under experience ({exp_st:.1f}-{exp_st+exp_d:.1f}s)")


if __name__ == "__main__":
    main()
