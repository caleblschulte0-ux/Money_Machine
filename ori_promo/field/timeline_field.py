#!/usr/bin/env python3
"""Emit the handoff timeline for v34 "THE FIELD GUIDE".

BEATS and the narration script are read out of spec_field.py/vo_field.py,
not retyped, for the same reason timeline_one.py reads spec_one.py: a
reviewer must never be asked to check a render against a hand-typed
description of it. The per-beat SHOT STRUCTURE section below is not
auto-extracted -- render_field.py's builders are plain imperative Python,
not a declarative table the way spec_one.py's LABELS/figures() are -- so
that section is a direct, line-by-line account of what each build_*()
function in render_field.py actually draws, written by reading the code,
not by describing the intended design from memory.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_field import BEATS, VO_LINES, TOTAL, W, H, FPS

STRUCTURE = {
    "open": [
        "0.0-6.0s   IMG_6799 @1.0s, real footage, full 16:9, daylight grade",
        "0.0-6.0s   title_card: \"A FIELD GUIDE TO\" / \"OPEN RANGE INTERACTIVE\" "
        "(paper panel, ink text -- no disclosure needed, not generated imagery)",
    ],
    "system": [
        "6.0-15.0s  split_screen: LEFT = ai/hero/glasses_hero_chatgpt.jpg (still, "
        "already-disclosed product photo) / RIGHT = IMG_6790 @5.0s real footage, "
        "person wearing the glasses",
        "6.0-15.0s  disclosure_tag \"PRODUCT VISUALIZATION\", corner tl "
        "(covers the LEFT/hardware half; the right half is real footage)",
        "6.0-15.0s  HARDWARE / SOFTWARE captions, bottom of each half",
    ],
    "borrow": [
        "15.0-20.0s IMG_6790 @14.0s real footage, walking the route",
        "15.0-18.2s step_strip active=BORROW",
        "18.2-20.0s step_strip active=EXPLORE",
        "20.0-23.0s build_worn_long(): ai/worn/product_worn_falls_park_plate_chatgpt.jpg "
        "re-encoded at 3.0s (same source as v33's `worn` beat, different duration)",
        "20.0-23.0s disclosure_tag \"PRODUCT VISUALIZATION\", corner tl",
        "20.0-23.0s step_strip HELD at active=EXPLORE, not RETURN -- there is no "
        "return-the-glasses footage in this beat, and highlighting RETURN over a "
        "shot of him wearing the glasses would visually claim wearing them is what "
        "returning looks like. RETURN is picked up in `destination` instead, where "
        "the narration (\"the glasses are returned\") actually matches.",
    ],
    "recognize": [
        "23.0-35.0s IMG_6806 @33.0s real footage (a clean, verified-unused stretch of "
        "the same 59.5s take v33's `lock`/`anchor` draws 8.4-19.7s from)",
        "23.0-35.0s map_zone_marker: a closing ring + dot, ink-colored, not a scan-line",
        "23.0-29.0s lower_card \"SYSTEM / RECOGNIZES THE EXPERIENCE ZONE\"",
        "29.0-35.0s lower_card \"SYSTEM / ANCHORS CONTENT TO PLACE\"",
    ],
    "experience": [
        "35.0-39.67s IMG_DAK1.MOV plate (Dakota reconstruction, already-disclosed asset)",
        "35.0-39.67s disclosure_tag \"VISUALIZATION\", corner tl",
        "35.0-39.67s lower_card \"EXAMPLE ONE / HISTORICAL RECONSTRUCTION\"",
        "39.67-44.33s HONEST GAP: no photoreal, location-matched ice-age asset exists. "
        "ai/ice/'s old pollinations renders are a stylized fantasy canyon with no "
        "falls and no tie to this location -- reusing them would present a worse, "
        "non-photoreal image as if it met the same bar dak/mam/worn/hardware do. "
        "Ships instead as a plain on-brand placeholder card reading "
        "\"NEEDED_ICEAGE_FALLS_VISUALIZATION / no photoreal, location-matched asset "
        "exists yet\" over solid paper.",
        "39.67-44.33s lower_card \"EXAMPLE TWO / ICE-AGE VISUALIZATION\"",
        "44.33-49.0s  IMG_6799 @3.0s real footage, dimmed/blended 55% with paper -- "
        "a diagram background, not a claim about what the footage shows",
        "44.33-49.0s  audio_sync_glyph: two points + bezier tie-line (no disclosure "
        "tag -- this is a drawn diagram over real footage, not fabricated imagery)",
        "44.33-49.0s  lower_card \"EXAMPLE THREE / SPATIAL AUDIO, SYNCHRONIZED\"",
    ],
    "destination": [
        "49.0-57.0s IMG_6799 @0.0s real footage",
        "49.0-51.2s step_strip active=RETURN, over real footage (no product visible "
        "in frame) -- matches the narration (\"the glasses are returned\") that "
        "`borrow`'s own step_strip deliberately deferred",
        "51.2-60.0s summary_card \"SITE-BASED - REUSABLE HARDWARE - UPDATEABLE SOFTWARE\"",
        "57.0-60.0s IMG_6802 @0.0s real footage (summary_card continues)",
    ],
    "close": [
        "60.0-66.0s IMG_6805 @19.0s real footage, locked-off wide of the falls "
        "(in-point moved from an originally-scouted 10.0s, where a jogger and a "
        "man walking a dog crossed the foreground and would have frozen mid-stride "
        "under the brand card for the final 4s; 19.0s is the same static shot with "
        "the foreground clear)",
        "66.0-70.0s last frame of 6805 held under title_card \"OPEN RANGE INTERACTIVE\" "
        "/ \"PLACE-BASED STORIES, SEEN WHERE THEY BELONG.\"",
    ],
}


def main():
    L = []
    L.append('ORI v34 -- "THE FIELD GUIDE"')
    L.append("Second execution in the operator-ordered five-style slate "
             "(r145__operator__five_style_variants.md); v33 is the first, frozen.")
    L.append(f"Running time {TOTAL:.3f}s   {W}x{H} @ {FPS} fps, full 16:9, no scope crop")
    L.append("")
    L.append("BEAT LIST -- generated from spec_field.py, not retyped")
    L.append("")
    for b, st, d, desc in BEATS:
        L.append(f"  {st:5.1f}-{st+d:5.1f}  {b:<11} {desc}")
    L.append("")
    L.append("SHOT STRUCTURE, DISCLOSURE INTERVALS -- read from render_field.py's "
              "own per-beat builder code, not from the design brief")
    L.append("")
    for b, st, d, desc in BEATS:
        for line in STRUCTURE.get(b, []):
            L.append(f"  {line}")
        L.append("")
    L.append("NARRATION, VERBATIM -- read from vo_field.py, not retyped "
              "(synthesized offline, piper en_US-lessac-high; no licensed or "
              "cloned voice)")
    L.append("")
    for beat, off, text in VO_LINES:
        bst = next(b[1] for b in BEATS if b[0] == beat)
        L.append(f"  {bst + off:5.1f}s  \"{text}\"")
    L.append("")
    L.append("  No date, no measurement, no attribution, no traction, no "
              "partnership, no deployment claim, no CTA.")
    L.append("")
    L.append("STANDING DISCLOSURE")
    L.append("  \"PRODUCT VISUALIZATION\" over the hardware plate (system) and the "
             "worn plate (borrow); plain \"VISUALIZATION\" over the historical "
             "reconstruction plate (experience, part one). Shown WHILE the "
             "generated/reconstructed imagery is on screen, cleared everywhere "
             "else. The ice-age example carries no disclosure tag because it "
             "carries no image at all -- an honest NEEDED_ placeholder in its "
             "place. The spatial-audio diagram carries no tag because it is a "
             "drawn diagram over real, undisclosed-needing footage, not "
             "fabricated imagery standing in for something real.")
    print("\n".join(L))


if __name__ == "__main__":
    main()
