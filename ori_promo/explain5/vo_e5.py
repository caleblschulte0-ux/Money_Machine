#!/usr/bin/env python3
"""Narration for ORI Explainer #5 ("The Silent Cut") -- there is none.

Last of the five videos requested by the operator (r145): five different
STYLES, same single purpose. explain1-4 each speak; THIS one carries no
narration at all -- LINES is deliberately empty. Every fact the other
four say out loud, this one says entirely through on-screen captions
(spec_e5.py's TITLES). main() below still runs unchanged: it writes a
silent out_e5/_vo.wav (all zeros) so assemble_e5.py's mix step has a
track to layer the score onto, exactly the same pipeline shape as every
other version, just with nothing recorded onto it.

Piper (en_US-lessac-high) stays the dependency in case a future revision
of this file adds lines back -- not fetched or invoked this run, since
LINES is empty and synth() is never called.
"""
import os
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_e5 import BEATS, TOTAL

SR = 48000
VOICE = "../vo/voices/en_US-lessac-high.onnx"

# EXPLAINER #5, silent cut. No LINES -- every fact lives in
# spec_e5.py's TITLES instead. Deliberately empty, not missing.
LINES = []


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
    os.makedirs("out_e5", exist_ok=True)
    n = int(TOTAL * SR)
    bus = np.zeros(n, np.float32)
    placed = []
    # PLACEMENT IS COMPUTED FROM THE ACTUAL SYNTHESIZED DURATION, not just
    # measured against it. Piper's duration prediction carries its own
    # noise term (noise_w_scale) -- re-synthesizing the SAME text with the
    # SAME model is not byte-identical run to run; measured swings of
    # ~0.3s on a single line during the v30.2 voice swap. A LINES offset
    # is therefore a REQUEST for where a line would ideally start (kept,
    # because several lines are anchored to a visual beat), not a
    # guarantee -- min_start below is the actual guarantee: no line may
    # start before the previous one's real audio, from THIS run, has
    # finished plus a fixed margin. This makes the whole file
    # self-correcting against synthesis variance for any voice, not just
    # the one it happened to be tuned against.
    MARGIN = 0.08
    min_start = None
    for idx, (beat, offset, text) in enumerate(LINES):
        st, dur = _beat_start(beat)
        # INDEXED, because a beat may now carry more than one line and the
        # old name collided: both `sign` lines wrote out_e5/_vo_sign.wav.
        # It happened to work only because each file is read back before
        # the next is written, which is not a property to rely on.
        a, sr = synth(text, f"out_e5/_vo_{idx:02d}_{beat}.wav")
        if sr != SR:                       # piper is 22.05k; resample to the master rate
            m = int(round(len(a) * SR / sr))
            a = np.interp(np.linspace(0, len(a) - 1, m), np.arange(len(a)), a).astype(np.float32)
        # a breath of room either side so it does not start on the cut
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
        placed.append((beat, at, len(a) / SR, text))
        if at + len(a) / SR > st + dur:
            print(f"  ! {beat}: line runs {at + len(a)/SR - (st+dur):.2f}s past the beat")
    peak = float(np.abs(bus).max())
    if peak > 0.98:
        bus *= 0.98 / peak
    pcm = (np.clip(bus, -1, 1) * 32767).astype(np.int16)
    with wave.open("out_e5/_vo.wav", "w") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())
    for beat, at, ln, text in placed:
        print(f"  vo {at:5.1f}s  {ln:4.1f}s  {beat:<5} \"{text}\"")


if __name__ == "__main__":
    main()
