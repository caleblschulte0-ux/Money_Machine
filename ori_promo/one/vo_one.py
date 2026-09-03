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
    # mam/now/off/walk KEEP their v18 text and relative offsets unchanged
    # -- `ice` was rewritten (below) so its own line still clears with
    # margin before mam's existing 1.6s offset lands, verified by
    # measurement, not assumption.
    ("sign", 0.10, "This is Falls Park, in Sioux Falls."),
    ("past", 0.10, "And most people walk right past."),
    # --- ACT 2: what it is, and the act of using it. `rail` and its line
    # are GONE (v19) -- see spec_one.py's note; the plaque is still on
    # screen during `sign`, so the "unseen story" point is not lost, only
    # unspoken a third time.
    # --- THE PRODUCT CLAIM WAS WRONG. Corrected v22, and this is the most
    # important line in the film to get right. It read "Open Range
    # Interactive is building AR glasses made for travel," which came from
    # the operator's own originally-approved 34s cut and had survived six
    # versions on that authority. He corrected it directly: "We're not
    # building AR glasses. We are going to get AR glasses from somebody and
    # implement our own software onto them and rent them out."
    # So the company is a SOFTWARE company with a rental distribution
    # model, and the film had been describing it as a hardware startup --
    # which is not a nuance, it is the wrong business. Two lines now: what
    # the company actually makes, and how a visitor actually gets it.
    # Neither states that this is running anywhere today; the end card's
    # PROPOSED FIRST BETA and VISUAL INTENTION ONLY still govern.
    ("prod", 0.15, "Open Range Interactive doesn't build the glasses. We build what runs on them."),
    ("on",   1.13, "You put them on, and the place starts talking."),
    ("lock", 0.95, "They know where you're standing, and what you're looking at."),
    # --- THE BREAKDOWN, CORRECTED v20. v19 used "The history, pinned to
    # the exact spot where it happened" -- the operator's own line from
    # the originally approved cut, but asked directly how recognition
    # actually works, he corrected the CLAIM behind it: "I would avoid
    # saying 'GPS pins it to the exact spot.' GPS alone is not precise
    # enough for that." GPS gets the wearer into the right zone; compass/
    # IMU/head-tracking and AR spatial tracking (SLAM) hold the overlay
    # steady against the real environment; only some experiences layer
    # computer-vision alignment on top. "Pinned to the exact spot" claims
    # more precision than that chain delivers. His own replacement
    # language, shortened to fit the beat: "anchors what you see to the
    # real place around you" -- paired with `lock`'s unchanged line, this
    # is still two consecutive capability statements (recognises you,
    # then anchors to the real world), just accurate ones now.
    ("open", 0.90, "And anchors what you see to the real place around you."),
    # `map`, v21. Operator's own legend concept (visual / audio / ambient /
    # lookout zones), stated in plain terms -- no zone count, no distance,
    # no claim this exact map is deployed today.
    # The rental half of the model, placed at the top of the map beat: you
    # get them AT the destination, and here is what the destination has in
    # it. "Where you're going" rather than "at Falls Park" keeps it a
    # statement about the model rather than a deployment claim.
    ("map", 0.30, "You don't buy a pair. You pick them up where you're going."),
    ("map", 2.90, "Some places show you something. Some just talk. Some just ask you to look."),
    # --- GROUP SYNC AND NO BLEED, v22. Operator: "you never talk about the
    # cool, like, features I mentioned earlier, how we are going to make it
    # so if you're in a group, your stuff will sync. If you're not in a
    # group, when you walk past another group, your stuff will not overlap
    # and it won't sound weird." Both halves, in his own terms, over the
    # diagram that shows them (one/sync_overlay.py). No user count, no
    # range, no latency figure -- only the behaviour he described.
    ("sync", 0.35, "In a group, everyone hears the same thing at the same time."),
    ("sync", 3.50, "And walk past another group, and theirs stays theirs."),
    # `reach`, v18, retimed for v19/v20. No rail, no menu -- he walks, and
    # the past is where he stops. This is the one sentence in the whole
    # script that states the operator's own line from the concept
    # document in different words: "walk to chapter 2," not "tap chapter
    # 2."
    ("reach", 0.22, "He walks. And the place answers where he stops."),
    # --- THE ERAS ARE BACK, v22, on the operator's reversal ("we took out
    # the AI cuts of the settlers and the natives, which is bad because
    # those were supposed to stay in"). `dak`'s line is the v19 wording
    # restored verbatim. `settle` is a NEW line for a NEW beat -- the v8
    # settlers beat never had one, because it was cut before the film had
    # narration at all. Same standard as everything else here: no date, no
    # measurement, no attribution, no named people.
    ("dak", 1.40, "Before the mill, people lived along this water."),
    ("settle", 1.20, "Then the mill came, and the town grew around it."),
    # `dak` and `more` LINES REMOVED, v20, with their beats -- see
    # spec_one.py's FIGURES note. `ice` now follows `reach` DIRECTLY, so
    # its line can no longer lean on "Same day, further up the bank" for
    # its own "further" to mean anything; rewritten to be self-contained.
    ("ice",  0.30, "Go back further, and the whole valley freezes."),
    ("mam",  1.50, "The whole valley under ice, and the animals that crossed it."),
    ("now",  1.80, "Then back. One place. Every time."),
    # --- ACT 4: the close.
    ("off",  0.30, "No tour group. No phone in your face. You just look."),
    ("walk", 0.60, "Open Range Interactive. See the story where you stand."),
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
