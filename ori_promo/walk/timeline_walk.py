#!/usr/bin/env python3
"""Emit the handoff timeline for v35 "THE WALKTHROUGH".

BEATS and the narration script are read out of spec_walk.py/vo_walk.py,
not retyped -- same discipline as timeline_field.py. The per-beat SHOT
STRUCTURE section is a direct account of render_walk.py's own per-beat
builder code (imperative Python, not a declarative table this can
introspect automatically), written by reading the code.
"""
import sys

sys.path.insert(0, ".")
from spec_walk import BEATS, VO_LINES, TOTAL, W, H, FPS

STRUCTURE = {
    "arrive": [
        "0.0-3.0s   IMG_6790 @0.6s real footage (in-point moved past a "
        "finger/thumb passing the lens in the clip's literal first 0.6s)",
        "0.0-3.0s   chapter_word \"ARRIVE\", top-left, understated",
        "3.0-7.0s   modest_title \"OPEN RANGE INTERACTIVE\" (small, NOT a "
        "full-screen brand card -- r174's explicit \"modest title\" spec)",
        "natural sound: a 1.7s location-audio snippet (highpass 300Hz, "
        "peak ~0.12) plays 0.0-1.7s, before narration settles in at 1.8s, "
        "matching r174's exact \"two seconds of location sound\" ask",
    ],
    "borrow": [
        "0.0-3.5s   ai/hero/glasses_hero_chatgpt.jpg, subtle push-in (1.05x)",
        "0.0-3.5s   disclosure \"PRODUCT VISUALIZATION\", corner tr, HELD "
        "CONTINUOUSLY (k=1.0 fixed, no fade envelope at all -- built this "
        "way from the start per r174's own criterion #4, not patched in "
        "after a review)",
        "0.0-3.5s   caption \"HARDWARE\"",
        "3.5-9.0s   ai/worn/product_worn_falls_park_plate_chatgpt.jpg, "
        "re-encoded at 5.5s (same source as v33's `worn` and v34's borrow "
        "beat, different duration each time), push-in 1.06x",
        "3.5-9.0s   disclosure \"PRODUCT VISUALIZATION\", corner tr, held continuously",
        "3.5-9.0s   caption \"SOFTWARE\" -- hard cut from hero to worn plate "
        "(a match cut, not v34's split-screen)",
    ],
    "walk": [
        "0.0-10.0s  IMG_6805 @38.0s real footage -- our recurring visitor "
        "walks past close to camera (~1s in) then away down the curved "
        "path; a candid, unstaged moment, not a framing error",
        "0.0-3.0s   chapter_word \"WALK\"",
        "0.0-10.0s  progress_line, thin white line filling left-to-right "
        "across the whole ARRIVE->RETURN arc (0.0-64.0s film time)",
        "natural sound: a 1.0s cut-in accent at 16.0s (this beat's own "
        "start), matching r174's \"one or two location-sound accents "
        "bridge the cuts\"",
    ],
    "recognize": [
        "0.0-12.0s  IMG_6806 @45.0s real footage -- re-scouted at 1s "
        "intervals across the FULL 59.5s clip after a first pass (3s "
        "intervals) wrongly judged an earlier in-point clean; a bystander "
        "is actually in frame continuously through ~0-27s of this clip. "
        "45.0-57.0s is confirmed clean and does not overlap v34's own "
        "33.0-45.0s window.",
        "0.0-6.0s   caption \"RECOGNIZES THE EXPERIENCE ZONE\"",
        "6.0-12.0s  caption \"ANCHORS CONTENT TO THIS PLACE\"",
        "0.0-12.0s  progress_line continues",
    ],
    "experience": [
        "0.0-5.33s  IMG_DAK1.MOV plate (Dakota reconstruction, already-disclosed asset)",
        "0.0-5.33s  disclosure \"VISUALIZATION\", corner tr, held continuously",
        "0.0-5.33s  caption \"HISTORICAL RECONSTRUCTION\"",
        "5.33-10.67s ai/iceage/iceage_falls_visualization_r172_chatgpt.jpg "
        "(r172's supplied plate, explicitly named for reuse by r174 itself), "
        "push-in 1.03x",
        "5.33-10.67s disclosure \"VISUALIZATION\", corner tr, held continuously",
        "5.33-10.67s caption \"ICE AGE VISUALIZATION\"",
        "10.67-16.0s IMG_6805 @80.0s real footage still, dimmed 60%/40% "
        "with a dark ground -- a diagram background, no disclosure tag "
        "needed (a drawn diagram over real footage, not fabricated imagery)",
        "10.67-16.0s sync_glyph: two points + bezier tie-line",
        "10.67-16.0s caption \"SPATIAL AUDIO, SYNCHRONIZED\"",
        "0.0-16.0s progress_line continues",
    ],
    "return": [
        "0.0-10.0s  IMG_6805 @48.0s real footage -- continuation of the "
        "same walking-away action from `walk`, further along (smaller, "
        "more distant) -- a truthful way to suggest the walk ending "
        "without staging a handoff shot that doesn't exist, per r174's "
        "explicit instruction",
        "0.0-3.0s   chapter_word \"RETURN\"",
        "0.0-3.3s   caption \"SITE-BASED EXPERIENCE\"",
        "3.3-6.6s   caption \"REUSABLE HARDWARE\"",
        "6.6-10.0s  caption \"UPDATEABLE SOFTWARE\"",
        "0.0-10.0s  progress_line reaches 1.0 by this beat's end (film time 64.0s)",
        "natural sound: a 1.0s cut-in accent at 54.0s (this beat's own start)",
    ],
    "close": [
        "0.0-8.0s   IMG_6805 @70.0s real footage, continuous motion "
        "throughout (the falls keep moving) -- no frozen hold, per r174's "
        "explicit \"finish on real moving footage\" requirement",
        "5.0-8.0s   end_card \"OPEN RANGE INTERACTIVE\" / \"PLACE-BASED "
        "STORIES, EXPERIENCED WHERE THEY BELONG\", held through the "
        "literal last rendered frame (verified via frame-accurate "
        "sequential decode of frame 239, not input-side seek) -- built "
        "with a true no-fade path (skips the release multiplier entirely, "
        "not just zeroes its margin: the latter still ramps to ~2.5% "
        "opacity one frame before the end, confirmed by direct "
        "calculation on the shared fade formula both v34 and this style "
        "started from)",
    ],
}


def main():
    L = []
    L.append('ORI v35 -- "THE WALKTHROUGH"')
    L.append("Third execution in the operator-ordered five-style slate "
             "(r145__operator__five_style_variants.md); v33 and v34 are "
             "the first two, both frozen.")
    L.append(f"Running time {TOTAL:.3f}s   {W}x{H} @ {FPS} fps, full 16:9, no scope crop")
    L.append("")
    L.append("BEAT LIST -- generated from spec_walk.py, not retyped")
    L.append("")
    for b, st, d, desc in BEATS:
        L.append(f"  {st:5.1f}-{st+d:5.1f}  {b:<11} {desc}")
    L.append("")
    L.append("SHOT STRUCTURE, DISCLOSURE INTERVALS, NATURAL-SOUND INTERVALS -- "
              "read from render_walk.py's/assemble_walk.py's own code")
    L.append("")
    for b, st, d, desc in BEATS:
        for line in STRUCTURE.get(b, []):
            L.append(f"  {line}")
        L.append("")
    L.append("NARRATION, VERBATIM -- read from vo_walk.py, not retyped "
              "(synthesized offline, piper en_US-lessac-high; no licensed or "
              "cloned voice)")
    L.append("")
    for beat, off, text in VO_LINES:
        bst = next(b[1] for b in BEATS if b[0] == beat)
        L.append(f"  {bst + off:5.1f}s  \"{text}\"")
    L.append("")
    L.append("  \"walk\"'s line is tightened from r174's exact wording (same "
              "claims, fewer words) -- the original ran to ~10.0s of "
              "synthesized audio against a ~9.4s speaking budget on a "
              "10.0s beat; r174 pre-authorized this exact kind of trim.")
    L.append("")
    L.append("  No date, no measurement, no attribution, no traction, no "
              "partnership, no deployment claim, no CTA.")
    L.append("")
    L.append("STANDING DISCLOSURE")
    L.append("  \"PRODUCT VISUALIZATION\" over the hardware detail and the worn "
             "plate (borrow); plain \"VISUALIZATION\" over the historical "
             "reconstruction plate and the ice-age plate (experience). All "
             "four held CONTINUOUSLY for their complete interval by "
             "construction (disclosure() defaults k=1.0, no fade envelope "
             "at all) -- built this way from the start, per r174's explicit "
             "editorial acceptance criterion #4, not patched in afterward. "
             "The spatial-audio diagram carries no tag because it is a "
             "drawn diagram over real footage, not fabricated imagery.")
    print("\n".join(L))


if __name__ == "__main__":
    main()
