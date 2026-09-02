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
# THE WORDING IS THE OPERATOR'S, NOT MINE. v16 has to explain the product
# to someone who has never heard of it, and the claim lines below are
# lifted from the cut he approved and documented in ori_promo/README.md --
# "AR glasses made for travel", "the place starts talking", "No tour
# group. No phone in your face. You just look.", "See the story where you
# stand." Writing fresh marketing copy here would have meant inventing
# positioning for a company on its behalf, which is the one thing this
# project has said all along that neither agent may do. Reusing his own
# approved sentences is not laziness; it is the only source of claim
# language on this project that has actually been signed off.
# Still no date, no measurement, no attribution, no traction, no raise,
# no partnership, no deployment claim and no call to action.
LINES = [
    # --- v19: OFFSETS RECOMPUTED FROM MEASURED PIPER DURATIONS, not
    # estimated. Operator, on v18: "way too much b roll on the front end
    # ... we don't breakdown what makes our product special." Fixing the
    # PICTURE (shorter beats, see spec_one.py) is only half of it -- the
    # ORIGINAL v18 sentences, spoken at their natural length, would have
    # run the narration further and further behind the faster cuts and
    # eventually decoupled the words from what they describe. Every line
    # below was synthesized once to measure its real duration, then
    # placed so line N+1 starts only after line N's audio actually ends
    # (0.05-0.1s margin) -- not after N's BEAT ends, which is a different
    # number now that beats are this short. Two lines were cut outright
    # (`rail`'s, and the "plaques and little signs" second sentence on
    # `sign`) rather than compressed into something that no longer scans;
    # the picture still shows the plaque, so the point survives on screen
    # even though the VO no longer spells it out.
    #
    # ACT 3 onward (dak/more/ice/mam/now/off/walk) is UNCHANGED from v18
    # -- same text, same relative offsets -- because `reach`'s line
    # (below) still finishes with margin before dak's existing 1.9s
    # offset lands, verified by measurement, not assumption.
    ("sign", 0.10, "This is Falls Park, in Sioux Falls."),
    ("past", 0.10, "And most people walk right past."),
    # --- ACT 2: what it is, and the act of using it. `rail` and its line
    # are GONE (v19) -- see spec_one.py's note; the plaque is still on
    # screen during `sign`, so the "unseen story" point is not lost, only
    # unspoken a third time.
    ("prod", 0.10, "Open Range Interactive is building AR glasses made for travel."),
    ("on",   1.13, "You put them on, and the place starts talking."),
    ("lock", 0.95, "They know where you're standing, and what you're looking at."),
    # --- THE BREAKDOWN. Was "So take the falls, and run them
    # backwards." -- a transition, not a claim. Replaced with the
    # operator's OWN vetted capability line from the originally approved
    # 34s cut (ori_promo/README.md), reused verbatim rather than
    # invented: paired with `lock`'s line above, this is two consecutive,
    # concrete statements of what the device does, immediately before the
    # film proves both by demonstration.
    ("open", 0.90, "The history, pinned to the exact spot where it happened."),
    # `reach`, v18, retimed for v19. No rail, no menu -- he walks, and the
    # past is where he stops. This is the one sentence in the whole
    # script that states the operator's own line from the concept
    # document in different words: "walk to chapter 2," not "tap chapter
    # 2."
    ("reach", 0.73, "He walks. And the place answers where he stops."),
    ("dak",  1.9, "Before the mill, people lived along this water."),
    # the rail does not move for this one -- he turned his head, he did
    # not change the year, and the line has to say so or the beat reads as
    # a second unrelated tableau
    ("more", 1.6, "Same day. Further up the bank."),
    ("ice",  0.9, "Further back."),
    ("mam",  1.6, "The whole valley under ice, and the animals that crossed it."),
    ("now",  2.1, "Then back. One place. Every time."),
    # --- ACT 4: the close.
    ("off",  0.6, "No tour group. No phone in your face. You just look."),
    ("walk", 0.7, "Open Range Interactive. See the story where you stand."),
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
    for idx, (beat, offset, text) in enumerate(LINES):
        st, dur = _beat_start(beat)
        # INDEXED, because a beat may now carry more than one line and the
        # old name collided: both `sign` lines wrote out1/_vo_sign.wav.
        # It happened to work only because each file is read back before
        # the next is written, which is not a property to rely on.
        a, sr = synth(text, f"out1/_vo_{idx:02d}_{beat}.wav")
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
