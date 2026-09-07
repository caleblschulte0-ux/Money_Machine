#!/usr/bin/env python3
"""Narration, synthesized offline, cut to the beats.

v32. NEW CONCEPT, not a v31 retime. Operator, after v31: "I said burn the
old video... completely start from scratch. That was not scratched. I
wanna see nothing similar from the last video." v31 kept every fact
attached to the same historical-eras walkthrough, just slower. This
throws the eras out entirely (spec_one.py) and rewrites every line that
assumed they existed.

Lines that made NO assumption about the eras are reused verbatim -- `off`
("No tour group. No phone in your face. You just look.") never referenced
history and didn't need touching. Lines that only make sense if the
glasses are about to show you the past ("He walks. The place answers
where he stops." / "...See the story where you stand.") had to be
rewritten, because "the story" and "answers where he stops" were both
promises this cut no longer keeps.

Still sparser than one line per beat: `sign`, `hero` and `end` carry NO
voice at all -- the location card, the product glance and the closing
wordmark all say what they need to without narration under them. Same
reasoning as v31: a card that also gets read aloud is saying the same
thing twice.

THE OPERATOR (standing, from before v31, still true): "add a little
narration and completely cut the sound out of the videos because there's
a lot of me talking in the background because there wasn't meant to be
sound in the videos." The location bed is still gone from the master --
not ducked, not gated, gone -- so narration is not competing with a river
and a voice off-camera.

WHAT IT MAY AND MAY NOT SAY. The standing rule on this project is that
nothing invents a raise, terms, traction, a partnership, a deployment or a
CTA, and that generated imagery is a VISUALISATION and never evidence. So
the script names no date, no measurement, no attribution and no claim
about what is deployed today. This cut doesn't even reach for the
"before the mill" / "the ice" level of historical assertion any more --
there is no history in it at all, which makes the claims surface smaller,
not larger.

Piper (en_US-lessac-high), CPU, offline, no licence attached to the output.
Nothing here is a stock read or a cloned voice.

VOICE MODEL FILES ARE NOT COMMITTED (same as ryan-high never was -- both
are 100MB+ binaries, this project's own storage rule). Fetch on a fresh
checkout:
    curl -L -o vo/voices/en_US-lessac-high.onnx \
      https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx
    curl -L -o vo/voices/en_US-lessac-high.onnx.json \
      https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json

VOICE SWAPPED v30.2, en_US-ryan-high -> en_US-lessac-high. Not a diagnosed
complaint -- an experiment, run because every visible-frame defect found
across two harsh review passes had been fixed and "the video is ass" still
stood, and voice was the one film-wide element never checked. Measured,
not assumed: lessac's pitch standard deviation across three sample lines
ran 49-58 Hz against ryan's 24-36 Hz on the same text -- roughly double
the pitch variance, the direction that reads as less flat/monotone, not
just different. Ryan is still on disk (vo/voices/en_US-ryan-high.onnx);
reverting is a one-line change back plus re-running this file, nothing
destructive.

PLACEMENT IS STILL COMPUTED, NOT JUST OFFSET -- see main()'s min_start
logic below, carried over unchanged from v31. Piper's own synthesis noise
(noise_w_scale) means the same text does not render to the same duration
twice, so an offset in LINES is a request for where a line would ideally
start, and the actual guarantee is that no line starts before the
previous one's REAL measured audio from this run has finished plus a
fixed margin. That mechanism doesn't care whether the words changed
underneath it, which is exactly why it didn't need touching for this
rewrite -- new lines, same self-correcting placement.
"""
import os
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_one import BEATS, TOTAL

SR = 48000
VOICE = "../vo/voices/en_US-lessac-high.onnx"

# (beat, seconds into that beat, line)
# THE WORDING IS STILL THE OPERATOR'S APPROVED FACTS -- rewired for v32's
# no-eras concept, not invented fresh. Every capability claim below
# already existed and was already vetted: "we build what runs on them"
# (the corrected software-not-hardware business model), "they know where
# you're standing, and what you're looking at" (recognition), "anchors
# what you see to the real place around you" (his own corrected anchoring
# language), the rental-pickup model ("picked up where you're going, not
# owned"), the group-sync behaviour ("who you're with"). None of that
# changed. What changed is `reach` and `walk`, which BOTH assumed a
# historical reveal was coming ("the place answers where he stops" / "see
# the story where you stand") and had to be rewritten to say something
# true about a film that has no reveal in it: the capability keeps
# working as he keeps moving, full stop. Nothing here states a date, a
# measurement, an attribution, traction, a partnership, a deployment
# claim or a CTA.
LINES = [
    # `sign` carries NO VO -- the location card (TITLES, spec_one.py) says
    # where this is in text; a voice repeating "This is Falls Park" under
    # a card that already says FALLS PARK is redundant.
    ("past", 0.20, "Most people walk right past."),
    ("prod", 0.20, "Open Range Interactive doesn't build the glasses. We build what runs on them."),
    # `hero` carries NO VO -- a brief glance at the product alone, with the
    # on-screen label already reading "THE HARDWARE." Let it be looked at.
    ("on",   0.20, "You put them on."),
    # This and `anchor` below are the SAME UNBROKEN SHOT (spec_one.py) --
    # one continuous take carrying two capability statements back to back,
    # with no cut between them.
    ("lock", 0.20, "They know where you're standing, what you're looking at — and who you're with."),
    ("anchor", 0.20, "Anchored to the real place around you. Picked up where you're going, not owned."),
    # REWRITTEN. The old line ("He walks. The place answers where he
    # stops.") was a setup line for the historical reveal that used to
    # follow it -- there is no reveal to set up any more. This says what's
    # actually true of THIS cut: the capability doesn't stop at one
    # recognised spot, it keeps up with him.
    # PRONOUN FIXED, r134 (ChatGPT's active fresh-look review): every
    # other line in this film is second person ("you put them on",
    # "where you're standing", "who you're with") and this one alone
    # dropped to third ("He keeps walking"), an unexplained viewpoint
    # shift nobody had caught. "You keep walking" is the same claim in
    # the voice the rest of the film already uses.
    ("reach", 0.25, "You keep walking. It keeps working."),
    ("off",  0.20, "No tour group. No phone in your face. You just look."),
    # REWRITTEN. "See the story where you stand" promised a narrative
    # payoff (the eras) that this cut doesn't have. The new line closes on
    # the actual capability -- look closer at the real place you're
    # already standing in -- with no promise the film hasn't kept.
    ("walk", 0.30, "Open Range Interactive. Look closer at where you already are."),
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
        # old name collided: both `sign` lines wrote out1/_vo_sign.wav.
        # It happened to work only because each file is read back before
        # the next is written, which is not a property to rely on.
        a, sr = synth(text, f"out1/_vo_{idx:02d}_{beat}.wav")
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
    with wave.open("out1/_vo.wav", "w") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.stack([pcm, pcm], 1).tobytes())
    for beat, at, ln, text in placed:
        print(f"  vo {at:5.1f}s  {ln:4.1f}s  {beat:<5} \"{text}\"")


if __name__ == "__main__":
    main()
