#!/usr/bin/env python3
"""Emit the handoff timeline for v36 "HOW THE SYSTEM WORKS".

SECTIONS and the narration script are read out of spec_map.py/vo_map.py,
not retyped. The per-section SHOT STRUCTURE is a direct account of
render_map.py's own per-section builder code, written by reading it.
"""
import sys

sys.path.insert(0, ".")
from spec_map import SECTIONS, VO_LINES, TOTAL, W, H, FPS

STRUCTURE = {
    "place": [
        "0.0-7.0s   IMG_6790 @10.0s real footage, full-bleed (edge-to-edge, "
        "no visible mask)",
        "0.0-2.0s   plain footage, no map elements -- r178's explicit "
        "\"at least two seconds before the system map begins to draw\"",
        "0.0-7.0s   section_label \"THE PLACE\", top-left",
        "2.0-6.0s   PLACE node fades in (active/pulsing), reaches steady "
        "\"done\" state at 6.0s -- warm amber (the only physical-place node "
        "color, per r178's own color rule)",
        "0.0-7.0s   \"SYSTEM DIAGRAM\" tag, held continuously (r178's own "
        "explicit instruction: label the map sequence so it cannot be "
        "mistaken for evidence of a deployed interface)",
    ],
    "hwsw": [
        "0.0-11.0s  dark map field (graphics_map.background()); a small "
        "persistent circular PLACE inset (real IMG_6790 @10.0s footage, "
        "continuous motion, not frozen) stays visible bottom-left for the "
        "whole section, satisfying r178's acceptance criterion #4 (real "
        "footage in every major section)",
        "0.0-11.0s  the spine path (PLACE->HARDWARE->SOFTWARE->ZONE) lit up "
        "to the current global time; each node's ring state (pending/"
        "active/done) is driven by the same arrival times -- the literal "
        "mechanism behind r178's \"transitions motivated by the path "
        "reaching the next node\"",
        "3.0-7.5s   HARDWARE node active: small aperture shows "
        "ai/hero/glasses_hero_chatgpt.jpg (the WHOLE plate scaled to fit "
        "the circle, not a crop -- see graphics_map.py's small_aperture() "
        "docstring for a real bug this caught and fixed), disclosure "
        "\"PRODUCT VISUALIZATION\" held continuously, caption "
        "\"BORROWED GLASSES — HARDWARE\"",
        "7.5-11.0s  SOFTWARE node active: small aperture shows "
        "ai/worn/product_worn_falls_park_plate_chatgpt.jpg, same "
        "disclosure, caption \"PLACE-BASED EXPERIENCE — SOFTWARE\"",
    ],
    "zone": [
        "0.0-13.0s  IMG_6805 @20.0s real footage, full-bleed -- a clean, "
        "previously-unused window on this clip (v33/v34/v35 all used "
        "36-58s and 70-92s; this is the 16-36s window, started at 20.0s "
        "to clear a jogger passing at ~16-18s). A small, consistently-"
        "distant background pedestrian is present through most of this "
        "window (ordinary public-park ambiance, not a prominent or "
        "confusing bystander -- disclosed here for transparency, judged "
        "acceptable rather than re-scouted)",
        "0.0-13.0s  a thin (k=0.55, no glow) spine overlay, arriving at "
        "ZONE partway through",
        "3.0-3.0s   ZONE node arrives at global t=21.0s (3.0s into this "
        "section)",
        "3.0-6.5s   caption \"RECOGNIZES THE EXPERIENCE ZONE\"",
        "6.5-13.0s  caption \"ANCHORS CONTENT TO THIS PLACE\"",
    ],
    "examples": [
        "r178's own instruction: three unequal, moving examples branching "
        "off ZONE -- explicitly not three equal holds (the exact mistake "
        "v35's first cut made and r176 caught). Rendered as three "
        "independent parts (examples_hist/ice/audio), each its own "
        "process -- the combined 540-frame single build kept exceeding "
        "the harness's background wall-clock limit; concatenated after.",
        "0.0-5.0s   HISTORICAL: IMG_DAK1.MOV plate, aperture r=130 "
        "(larger scale), branch line from ZONE lighting in ~0.6s, "
        "disclosure \"VISUALIZATION\" held continuously, caption "
        "\"HISTORICAL RECONSTRUCTION\"",
        "5.0-12.5s  ICE AGE: ai/iceage/iceage_falls_visualization_r172_"
        "chatgpt.jpg, push-in 1.04x, aperture r=170 (largest of the three "
        "-- longest hold, biggest scale), same disclosure discipline, "
        "caption \"ICE AGE VISUALIZATION\"",
        "12.5-18.0s AUDIO: real footage still (IMG_6805 @33.0s, dimmed), "
        "aperture r=95 (smallest, fastest of the three), sync_glyph-style "
        "treatment folded into the small aperture itself, no disclosure "
        "tag (a diagram over real footage, not fabricated imagery), "
        "caption \"SPATIAL AUDIO, SYNCHRONIZED\"",
        "Durations 5.0 / 7.5 / 5.5s and apertures 130 / 170 / 95px are "
        "all distinct -- satisfies \"vary duration, scale, and entry "
        "direction\" as three genuinely different numbers, not two "
        "matching one different.",
    ],
    "loop": [
        "0.0-14.0s  dark map field; persistent PLACE inset continues "
        "(same technique as hwsw)",
        "0.0-14.0s  the loop closes progressively: BORROW (already at the "
        "entry point) -> EXPERIENCE (arrives 3.5s in) -> RETURN (7.0s) -> "
        "UPDATE (10.5s) -> closes back to BORROW (14.0s, this section's "
        "own end) -- r178's \"operating loop\" collapsed into a simple "
        "4-node closed diagram",
        "13.7-14.0s caption \"BORROW → EXPERIENCE → RETURN → UPDATE\" "
        "appears once the loop is fully closed",
    ],
    "close": [
        "0.0-11.0s  IMG_6790 @20.0s real footage, full-bleed, continuous "
        "motion throughout -- a different sub-window of the same clean "
        "overlook stretch PLACE opened on (10.0s), so open and close "
        "aren't the identical clip",
        "0.0-7.5s   \"SYSTEM DIAGRAM\" tag only -- map fully faded out, "
        "footage resolves plain",
        "7.5-11.0s  end_card \"OPEN RANGE INTERACTIVE\" / \"PLACE-BASED "
        "STORIES, EXPERIENCED WHERE THEY BELONG\", held through the "
        "literal last rendered frame (true no-fade path, same fix v35's "
        "r175 round landed on -- verified by frame-accurate sequential "
        "decode of frame 329, not input-side seek)",
    ],
}


def main():
    L = []
    L.append('ORI v36 -- "HOW THE SYSTEM WORKS"')
    L.append("Fourth execution in the operator-ordered five-style slate "
             "(r145__operator__five_style_variants.md); v33/r167 and "
             "v34/r173 are frozen, v35/r177 is visually locked pending "
             "only an operator audio spot-check.")
    L.append(f"Running time {TOTAL:.3f}s   {W}x{H} @ {FPS} fps, full 16:9, no scope crop")
    L.append("")
    L.append("SECTION LIST -- generated from spec_map.py, not retyped")
    L.append("")
    for s, st, d, desc in SECTIONS:
        L.append(f"  {st:5.1f}-{st+d:5.1f}  {s:<9} {desc}")
    L.append("")
    L.append("SHOT STRUCTURE, DISCLOSURE INTERVALS -- read from render_map.py's own code")
    L.append("")
    for s, st, d, desc in SECTIONS:
        for line in STRUCTURE.get(s, []):
            L.append(f"  {line}")
        L.append("")
    L.append("NARRATION, VERBATIM -- read from vo_map.py, not retyped "
              "(synthesized offline, piper en_US-lessac-high; no licensed "
              "or cloned voice; a FRESH script for this structure, per "
              "r178's explicit instruction not to reuse v35's walkthrough "
              "narration)")
    L.append("")
    for sec, off, text in VO_LINES:
        sst = next(s[1] for s in SECTIONS if s[0] == sec)
        L.append(f"  {sst + off:5.1f}s  \"{text}\"")
    L.append("")
    L.append("  \"place\"'s line is tightened from the original draft (same "
              "claim, fewer words) -- it measured to ~6.78s of synthesized "
              "audio against a ~5.2s speaking budget on the 7.0s section; "
              "same class of trim r174 pre-authorized for v35.")
    L.append("")
    L.append("  No date, no measurement, no attribution, no traction, no "
              "partnership, no deployment claim, no CTA, no GPS/computer-"
              "vision/beacon/compass/precision/latency implementation "
              "detail -- all explicitly ruled out by r178.")
    L.append("")
    L.append("STANDING DISCLOSURE")
    L.append("  \"PRODUCT VISUALIZATION\" over the hero-glasses and worn "
             "plates (hwsw); plain \"VISUALIZATION\" over the historical "
             "reconstruction plate and the ice-age plate (examples). All "
             "four held CONTINUOUSLY for their complete on-screen interval "
             "(disclosure() defaults to fixed k=1.0, no fade envelope at "
             "all -- same discipline v35's r175 established). The "
             "spatial-audio example carries no tag because it is a real "
             "footage still with a drawn diagram overlay, not fabricated "
             "imagery. \"SYSTEM DIAGRAM\" is held continuously across "
             "every section per r178's own explicit instruction, so the "
             "animated map is never mistaken for a recording of a "
             "deployed interface.")
    L.append("")
    L.append("SOUND")
    L.append("  Narration only -- no score, no sound effects. r178's "
             "brief doesn't ask for one, unlike r174's explicit natural-"
             "sound request for v35; adding invented interface sound "
             "design without that being asked for would be scope creep. "
             "Flagged in the round report as an easy optional addition if "
             "wanted on a later pass.")
    print("\n".join(L))


if __name__ == "__main__":
    main()
