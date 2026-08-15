#!/usr/bin/env python3
"""License-clean synthesized music bed for the ORI promo (~34s).

Warm pad chords (Am - F - C - G), a soft sub pulse, and airy filtered
noise. Deliberately understated — it sits under VO.
"""
import numpy as np
import wave

SR = 44100
DUR = 46.0
BPM = 96
BEAT = 60.0 / BPM
BAR = BEAT * 4

t = np.arange(int(SR * DUR)) / SR
out = np.zeros_like(t)

# Chord progression, one chord per bar, looped.
CHORDS = [
    [220.00, 261.63, 329.63],          # A minor
    [174.61, 220.00, 261.63],          # F major
    [130.81, 164.81, 196.00, 261.63],  # C major
    [196.00, 246.94, 293.66],          # G major
]

def adsr(n, a, r, sr=SR):
    env = np.ones(n)
    an, rn = min(int(a * sr), n // 2), min(int(r * sr), n // 2)
    if an:
        env[:an] = np.linspace(0, 1, an)
    if rn:
        env[-rn:] *= np.linspace(1, 0, rn)
    return env

# Pads: detuned saws through a soft "lowpass" (harmonic rolloff).
bar_i = 0
pos = 0.0
while pos < DUR:
    chord = CHORDS[bar_i % len(CHORDS)]
    n = int(min(BAR + 0.6, DUR - pos) * SR)
    tt = np.arange(n) / SR
    seg = np.zeros(n)
    for f in chord:
        for det in (-0.15, 0.0, 0.15):
            for h in range(1, 6):
                seg += (0.9 ** h / h) * np.sin(2 * np.pi * (f + det) * h * tt
                                               + np.random.rand() * 6.28)
    seg *= adsr(n, 0.8, 1.2) * 0.028
    i0 = int(pos * SR)
    out[i0:i0 + n] += seg[:len(out) - i0]
    pos += BAR
    bar_i += 1

# Sub pulse on beats 1 and 3 — gentle heartbeat.
pos = 0.0
while pos < DUR - 0.5:
    n = int(0.42 * SR)
    tt = np.arange(n) / SR
    root = CHORDS[int(pos / BAR) % len(CHORDS)][0] / 4
    seg = np.sin(2 * np.pi * root * tt) * adsr(n, 0.012, 0.3) * 0.16
    i0 = int(pos * SR)
    out[i0:i0 + n] += seg[:len(out) - i0]
    pos += BEAT * 2

# Air: slowly-breathing filtered noise.
noise = np.random.randn(len(t))
kernel = np.ones(220) / 220          # crude lowpass
noise = np.convolve(noise, kernel, mode="same")
breathe = 0.5 + 0.5 * np.sin(2 * np.pi * t / 8.0)
out += noise * breathe * 0.02

# Gentle intro fade + master shape.
fade_in = np.clip(t / 1.5, 0, 1)
out *= fade_in
out /= np.abs(out).max() * 1.15

pcm = (out * 32767 * 0.7).astype(np.int16)
with wave.open("work/music.wav", "w") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("music.wav written")
