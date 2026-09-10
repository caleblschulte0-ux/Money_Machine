#!/usr/bin/env python3
"""v36 "HOW THE SYSTEM WORKS" -- narration. Same synthesis/placement
machinery as one/vo_one.py, field/vo_field.py, walk/vo_walk.py (Piper,
offline, en_US-lessac-high; placement is COMPUTED from the actual
synthesized duration each run). r178 requires a FRESH script for this
structure, not v35's walkthrough narration reused -- spec_map.py's
VO_LINES is that fresh script.
"""
import os
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_map import SECTIONS, VO_LINES, TOTAL

SR = 48000
VOICE = "../vo/voices/en_US-lessac-high.onnx"


def _sec_start(name):
    for s, st, d, desc in SECTIONS:
        if s == name:
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
    os.makedirs("out_map", exist_ok=True)
    n = int(TOTAL * SR)
    bus = np.zeros(n, np.float32)
    placed = []
    MARGIN = 0.10
    min_start = None
    for idx, (sec, offset, text) in enumerate(VO_LINES):
        st, dur = _sec_start(sec)
        a, sr = synth(text, f"out_map/_vo_{idx:02d}_{sec}.wav")
        if sr != SR:
            m = int(round(len(a) * SR / sr))
            a = np.interp(np.linspace(0, len(a) - 1, m), np.arange(len(a)), a).astype(np.float32)
        at = st + offset
        if min_start is not None:
            at = max(at, min_start)
        i0 = int(at * SR)
        seg = a * 0.92
        k = int(0.04 * SR)
        seg[:k] *= np.linspace(0, 1, k)
        seg[-k:] *= np.linspace(1, 0, k)
        end = min(n, i0 + len(seg))
        bus[i0:end] += seg[:end - i0]
        min_start = at + len(a) / SR + MARGIN
        placed.append((sec, at, len(a) / SR, text))
        if at + len(a) / SR > st + dur:
            print(f"  ! {sec}: line runs {at + len(a)/SR - (st+dur):.2f}s past the section")
    peak = float(np.abs(bus).max())
    if peak > 0.98:
        bus *= 0.98 / peak
    pcm = (np.clip(bus, -1, 1) * 32767).astype(np.int16)
    with wave.open("out_map/_vo.wav", "w") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())
    for sec, at, ln, text in placed:
        print(f"  vo {at:5.1f}s  {ln:4.1f}s  {sec:<10} \"{text}\"")


if __name__ == "__main__":
    main()
