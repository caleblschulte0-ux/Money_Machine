#!/usr/bin/env python3
"""Narration for ORI Explainer #1 ("The Idea"), synthesized offline.

One of five videos requested by the operator (r145): five different
STYLES, same single purpose -- a full, self-contained YouTube explainer,
not a teaser. v32c stays exactly as it is. This script's LINES actually
explain each concept (the software/hardware distinction, recognition,
anchoring, the rental model, the honest beta framing, extensibility)
rather than gesturing at them the way the 41s teaser does.

Same standing rule as every version before this one: no invented raise,
terms, traction, partnership, deployment date, or CTA; generated imagery
is a VISUALIZATION, never evidence (FIGURES is empty here, so that
disclosure banner never fires, same as v32c).

Piper (en_US-lessac-high), CPU, offline, no licence attached to the
output. Voice model files are not committed (100MB+ binaries) -- fetch on
a fresh checkout:
    curl -L -o vo/voices/en_US-lessac-high.onnx \
      https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx
    curl -L -o vo/voices/en_US-lessac-high.onnx.json \
      https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json

PLACEMENT IS COMPUTED, NOT JUST OFFSET -- see main()'s min_start logic,
carried over unchanged from v32c: Piper's synthesis noise means the same
text does not render to the same duration twice, so a LINES offset is a
request for where a line would ideally start, and the real guarantee is
that no line starts before the previous one's actual measured audio from
THIS run has finished plus a fixed margin.
"""
import os
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_e1 import BEATS, TOTAL

SR = 48000
VOICE = "../vo/voices/en_US-lessac-high.onnx"

# (beat, seconds into that beat, line)
# EXPLAINER #1, calm documentary style. Same approved facts as v32c,
# spoken more fully because this is a full explainer, not a teaser --
# no invented raise/terms/traction/partnership/deployment date, and the
# beta is explicitly named as PROPOSED, not live.
LINES = [
    ("open", 0.30, "This is Falls Park, in Sioux Falls, South Dakota. Most people walk right past most of it."),
    ("intro", 0.20, "Open Range Interactive is a software company. We don't build the glasses — we build what runs on them."),
    # `hero` carries no VO of its own; its label already reads
    # "THE HARDWARE" / "VISUALIZATION" and the line above already covers
    # what it's showing. Let it be looked at without being talked over.
    ("on",   0.20, "You put them on."),
    # `lock` and `anchor` are the SAME UNBROKEN TAKE (spec_e1.py) -- one
    # continuous shot carrying two capability statements with no cut.
    ("lock", 0.20, "They recognize where you're standing, and what you're looking at."),
    ("anchor", 0.20, "Whatever we show you is anchored to the real place around you — not a generic app."),
    ("rental", 0.30, "Destinations don't buy this outright. They rent the software package, the same way you'd license any other platform — picked up, not owned."),
    ("honest_stage", 0.30, "Right now, this is a proposal, not a finished rollout. Falls Park is the site we've picked for a first beta."),
    ("off",  0.20, "No tour group. No phone in your face. You just look."),
    ("reach", 0.20, "You keep walking. It keeps working, wherever you go."),
    ("vision", 0.30, "The same platform could bring real places like this one to life — anywhere."),
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


def _srt_ts(t):
    h = int(t // 3600); t -= h * 3600
    m = int(t // 60); t -= m * 60
    s = int(t); ms = int(round((t - s) * 1000))
    if ms >= 1000:
        s += 1; ms = 0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(placed, dst):
    """Standard .srt captions built from the SAME placement data the mixed
    VO track came from -- no separate timing table to drift out of sync."""
    lines = []
    for i, (beat, at, ln, text) in enumerate(placed, 1):
        lines.append(str(i))
        lines.append(f"{_srt_ts(at)} --> {_srt_ts(at + ln)}")
        lines.append(text)
        lines.append("")
    with open(dst, "w") as f:
        f.write("\n".join(lines))

def main():
    os.makedirs("out_e1", exist_ok=True)
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
        # old name collided: both `sign` lines wrote out_e1/_vo_sign.wav.
        # It happened to work only because each file is read back before
        # the next is written, which is not a property to rely on.
        a, sr = synth(text, f"out_e1/_vo_{idx:02d}_{beat}.wav")
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
    with wave.open("out_e1/_vo.wav", "w") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())
    for beat, at, ln, text in placed:
        print(f"  vo {at:5.1f}s  {ln:4.1f}s  {beat:<5} \"{text}\"")
    write_srt(placed, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                    "..", "out", "ORI_Explainer1_TheIdea_captions.srt"))


if __name__ == "__main__":
    main()
