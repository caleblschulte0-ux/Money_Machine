#!/usr/bin/env python3
"""v37 "THE WORLD / THE LAYER" -- score.

Every prior report for this style said "narration only, no score -- the
same judgment call every prior style in this slate has made." That claim
was never actually checked against the other four builds: v33 (one/) and
v34 (field/) both ship a synthesized score (score_one.py, score_field.py),
wired into their own assemble scripts. Only v35/v36/v37 shipped silent.
The operator's own "the whole vibe" note on the r193 cut is exactly what
a narrated-over-nature-sound video reads as next to a scored one -- this
was a real gap this session inherited and repeated, not a deliberate,
verified choice.

Bright major progression (C - G - Am - F, the "uplifting reveal"
progression) -- distinct from v33's elegiac A minor and v34's plain,
open C/Am/F/G, matching this style's own bright_edit_grade daylight
treatment and coral-accent energy. Arc follows the film's two real
events: the hook's own wipe-reveal transformation (this style's only
discrete "moment," the same role v33's glasses-on beat played for its
score), and the examples section (the richest passage, three sub-reveals
-- the same "swell under the demo" reasoning v34's score used). Loop
eases back so the four bold words aren't fighting a swell; close lets
the bed go before the end card, same discipline every prior score in
this slate holds.

Synthesized here -- no sample loaded, nothing licensed, regenerable from
source at any length.
"""
import os
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_layer import SECTIONS, TOTAL

SR = 48000
BPM = 96
BEAT = 60.0 / BPM
BAR = BEAT * 4

# C major, G major, A minor, F major -- I-V-vi-IV, the bright/optimistic
# "reveal" progression; nothing minor-key or elegiac.
CHORDS = [
    [130.81, 164.81, 196.00],           # C
    [196.00, 246.94, 293.66],           # G
    [220.00, 261.63, 329.63],           # Am
    [174.61, 220.00, 261.63],           # F
]


def sec_at(name):
    for s, st, d, desc in SECTIONS:
        if s == name:
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
    u = np.clip((t - t0) / max(1e-6, t1 - t0), 0.0, 1.0)
    u = u * u * (3 - 2 * u)
    return lo + (hi - lo) * u


def main():
    n = int(TOTAL * SR)
    t = np.arange(n) / SR
    out = np.zeros(n, np.float32)

    hook_st, _ = sec_at("hook")
    wipe_st, wipe_end = 1.8, 4.2  # render_layer.py's own hook wipe window
    ex_st, ex_d = sec_at("examples")
    loop_st, _ = sec_at("loop")
    close_st, _ = sec_at("close")

    gain = np.full(n, 0.45, np.float32)
    gain = np.where(t < wipe_st, 0.22, gain)
    gain = np.where((t >= wipe_st) & (t < wipe_end),
                    ramp(t, wipe_st, wipe_end, 0.22, 0.45), gain)
    gain = np.where((t >= ex_st) & (t < ex_st + ex_d), 0.60, gain)
    gain = np.where((t >= loop_st) & (t < close_st), 0.42, gain)
    gain = np.where(t >= close_st, ramp(t, close_st, close_st + 2.0, 0.42, 0.24), gain)
    gain *= np.clip(t / 1.2, 0.0, 1.0)                        # fade in
    gain *= np.clip((TOTAL - 0.8 - t) / 2.2, 0.0, 1.0)         # let it go before the end card

    pos, bar_i = 0.0, 0
    rng = np.random.default_rng(19)
    while pos < TOTAL:
        chord = CHORDS[bar_i % len(CHORDS)]
        ln = int(min(BAR + 0.6, TOTAL - pos) * SR)
        if ln <= 0:
            break
        tt = np.arange(ln) / SR
        i0 = int(pos * SR)
        seg = np.zeros(ln)
        for f in sorted(chord):
            for det in (-0.14, 0.0, 0.14):
                for h in range(1, 5):
                    seg += (0.88 ** h / h) * np.sin(
                        2 * np.pi * (f + det) * h * tt + rng.random() * 6.28)
        seg *= adsr(ln, 0.9, 1.2) * 0.027
        out[i0:i0 + ln] += seg[:n - i0]
        pos += BAR
        bar_i += 1

    # Sub pulse on beats 1 and 3 -- a gentle heartbeat under the pads,
    # present throughout (this style has no "cold" state to thin it for).
    pos = 0.0
    while pos < TOTAL - 0.5:
        ln = int(0.42 * SR)
        i0 = int(pos * SR)
        if i0 + ln > n:
            break
        root = CHORDS[int(pos / BAR) % len(CHORDS)][0] / 4
        tt = np.arange(ln) / SR
        out[i0:i0 + ln] += (np.sin(2 * np.pi * root * tt)
                            * adsr(ln, 0.012, 0.30) * 0.14)
        pos += BEAT * 2

    noise = np.convolve(rng.standard_normal(n), np.ones(250) / 250, mode="same")
    breathe = 0.5 + 0.5 * np.sin(2 * np.pi * t / 10.0)
    out += noise * breathe * 0.014

    out *= gain
    peak = float(np.abs(out).max())
    if peak > 0:
        out /= peak * 1.12

    os.makedirs("out_layer", exist_ok=True)
    pcm = (np.clip(out, -1, 1) * 32767 * 0.68).astype(np.int16)
    with wave.open("out_layer/_music.wav", "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())
    print(f"  score: {TOTAL:.1f}s, quiet under {hook_st:.1f}-{wipe_st:.1f}s, "
          f"lift at {wipe_st:.1f}-{wipe_end:.1f}s, swell under examples "
          f"{ex_st:.1f}-{ex_st+ex_d:.1f}s, release from {close_st:.1f}s")


if __name__ == "__main__":
    main()
