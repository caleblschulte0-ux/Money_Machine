#!/usr/bin/env python3
"""Narration, synthesized offline, cut to the beats.

OPERATOR: "add a little narration and completely cut the sound out of the
videos because there's a lot of me talking in the background because there
wasn't meant to be sound in the videos."

Both halves matter and the second one is the reason this file is short.
The location bed is GONE from the master -- not ducked, not gated, gone --
so narration is not competing with a river and a voice off-camera. That
also means every word here has to carry, because there is nothing else in
the gaps but the score.

WHAT IT MAY AND MAY NOT SAY. The standing rule on this project is that
nothing invents a raise, terms, traction, a partnership, a deployment or a
CTA, and that generated imagery is a VISUALISATION and never evidence. So
the script names no date, no measurement, no attribution and no claim
about what is deployed today. "Before the mill" and "the ice" are the same
level of assertion the on-screen labels already carry, and the film keeps
its VISUALISATION — NOT A PHOTOGRAPH tag while any of it is on screen.

Piper (en_US-ryan-high), CPU, offline, no licence attached to the output.
Nothing here is a stock read or a cloned voice.
"""
import os
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_one import BEATS, TOTAL

SR = 48000
VOICE = "../vo/voices/en_US-ryan-high.onnx"

# (beat, seconds into that beat, line)
LINES = [
    ("open", 1.1, "This is Falls Park, in Sioux Falls."),
    ("dak",  1.9, "Look at the rock, and it shows you who stood here before the mill."),
    ("ice",  1.6, "Further back, the whole valley was ice."),
    ("mam",  1.9, "And the animals that crossed it."),
    ("now",  1.4, "One place. Every time."),
]


def _beat_start(name):
    for b, clip, tin, st, d, note in BEATS:
        if b == name:
            return st, d
    raise KeyError(name)


def synth(text, path):
    from piper import PiperVoice
    v = PiperVoice.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), VOICE))
    with wave.open(path, "wb") as w:
        v.synthesize_wav(text, w)
    with wave.open(path, "rb") as w:
        n, sr = w.getnframes(), w.getframerate()
        a = np.frombuffer(w.readframes(n), np.int16).astype(np.float32) / 32768.0
    return a, sr


def main():
    os.makedirs("out1", exist_ok=True)
    n = int(TOTAL * SR)
    bus = np.zeros(n, np.float32)
    placed = []
    for beat, offset, text in LINES:
        st, dur = _beat_start(beat)
        a, sr = synth(text, f"out1/_vo_{beat}.wav")
        if sr != SR:                       # piper is 22.05k; resample to the master rate
            m = int(round(len(a) * SR / sr))
            a = np.interp(np.linspace(0, len(a) - 1, m), np.arange(len(a)), a).astype(np.float32)
        # a breath of room either side so it does not start on the cut
        at = st + offset
        i0 = int(at * SR)
        seg = a * 0.92
        k = int(0.04 * SR)
        seg[:k] *= np.linspace(0, 1, k)
        seg[-k:] *= np.linspace(1, 0, k)
        end = min(n, i0 + len(seg))
        bus[i0:end] += seg[:end - i0]
        placed.append((beat, at, len(a) / SR, text))
        if at + len(a) / SR > st + dur:
            print(f"  ! {beat}: line runs {at + len(a)/SR - (st+dur):.2f}s past the beat")
    peak = float(np.abs(bus).max())
    if peak > 0.98:
        bus *= 0.98 / peak
    pcm = (np.clip(bus, -1, 1) * 32767).astype(np.int16)
    with wave.open("out1/_vo.wav", "w") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())
    for beat, at, ln, text in placed:
        print(f"  vo {at:5.1f}s  {ln:4.1f}s  {beat:<5} \"{text}\"")


if __name__ == "__main__":
    main()
