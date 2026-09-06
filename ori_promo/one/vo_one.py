#!/usr/bin/env python3
"""Narration, synthesized offline, cut to the beats.

v31 FULL RESTART. Operator: "Completely burn down what you have.
Completely restart with the whole thing in mind that this needs to look
like an Apple promo video." The structural change here is not shorter
lines, it's FEWER OF THEM. Apple spots do not narrate every second --
four beats now carry NO voice at all (`sign`, `hero`, `now`, `end`): the
location card, the product shot, the "ONE PLACE / EVERY TIME" title and
the closing wordmark all say what they need to say without a voice
under them, because a location card that ALSO gets read aloud, or a
title card that ALSO gets read aloud, is saying the same thing twice --
which reads as nervous, not confident. Silence over a beautiful held
frame, with just score under it, is the point in this genre, not a gap
to fill.

THE OPERATOR: "add a little narration and completely cut the sound out of
the videos because there's a lot of me talking in the background because
there wasn't meant to be sound in the videos."

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

THE OFFSETS BELOW ARE RETIMED FOR LESSAC, NOT REUSED FROM RYAN. Piper
voices do not share a clock -- lessac runs 7-9% longer per line on this
script. Re-synthesizing with the old ryan-tuned offsets verified FIVE
genuine overlaps (lock, open, the second sync line, reach, walk -- each
would have started 0.03-0.42s before the previous line's audio actually
finished). Fixed by walking the lines in order and pushing only a line
that would truly overlap its immediate predecessor forward by just enough
margin (0.08s) to clear it -- never trimming or rewording a line, since
the wording is the operator's, not mine to edit. That local rule alone
resolved every case, including the tightest stretch in the film (on ->
lock -> open, three long lines back to back with almost no slack in
their own beats to begin with): the tail absorbs into map's own beat,
which has 5.0s of room for a ~2.8s line and needed it. Verified after the
fact, not assumed: every consecutive line gap below is >= +0.07s, zero
overlaps, checked programmatically against the real synthesized durations
before this was ever rendered into the master.
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
# THE WORDING IS THE OPERATOR'S FACTS, NOT MY INVENTION -- restructured
# for v31, not rewritten from nothing. Every claim below already existed
# somewhere in the pre-restart script and was already vetted: "we build
# what runs on them" (the corrected software-not-hardware business model),
# "they know where you're standing, and what you're looking at"
# (recognition), "anchors what you see to the real place around you"
# (his own corrected anchoring language, not the over-precise "GPS pins
# it" claim), the rental-pickup model ("you pick them up where you're
# going," previously the `map` beat's whole reason to exist), the
# group-sync behaviour (previously `sync`'s whole reason to exist), and
# the era lines and closing lines, unchanged. WHAT'S NEW is which beat
# each fact is attached to and how many words carry it -- the map/sync
# beats are gone as VISUALS (see spec_one.py), so the rental-pickup fact
# now rides as a second clause on `open`'s line and the group-sync fact
# rides as a second clause on `lock`'s, instead of each getting its own
# menu-card beat. Nothing here states a date, a measurement, an
# attribution, traction, a partnership, a deployment claim or a CTA.
LINES = [
    # `sign` carries NO VO -- the location card (TITLES, spec_one.py) says
    # where this is in text; a voice repeating "This is Falls Park" under
    # a card that already says FALLS PARK is the kind of redundancy this
    # restart is specifically cutting.
    ("past", 0.20, "Most people walk right past."),
    ("prod", 0.20, "Open Range Interactive doesn't build the glasses. We build what runs on them."),
    # `hero` carries NO VO -- 5.0s held on the product alone, with the
    # ON-SCREEN LABEL already reading "THE HARDWARE." Let it be looked at.
    ("on",   0.30, "You put them on."),
    # RECOGNITION *and* GROUP-SYNC, one sentence: this used to be `lock`'s
    # line alone plus a whole separate `sync` beat with a circle diagram
    # ("you hear the same thing... theirs stays theirs"). The CAPABILITY
    # survives as a single trailing clause; the diagram does not.
    ("lock", 0.30, "They know where you're standing, what you're looking at — and who you're with."),
    # ANCHORING *and* the RENTAL MODEL, same move: `open`'s line plus what
    # used to be the entire `map` beat's opening line ("you don't buy a
    # pair, you pick them up where you're going").
    ("open", 0.30, "Anchored to the real place around you. Picked up where you're going, not owned."),
    ("reach", 0.30, "He walks. The place answers where he stops."),
    ("dak", 0.50, "Before the mill, people lived along this water."),
    ("settle", 0.40, "Then the mill came, and the town grew around it."),
    ("ice",  0.30, "Go back further — the whole valley freezes."),
    ("mam",  1.00, "The same valley — under ice, and the animals that crossed it."),
    # `now` carries NO VO -- the title card already says "ONE PLACE /
    # EVERY TIME"; this beat is picture and music only.
    ("off",  0.30, "No tour group. No phone in your face. You just look."),
    ("walk", 0.50, "Open Range Interactive. See the story where you stand."),
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
