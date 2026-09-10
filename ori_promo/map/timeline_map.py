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
        "r181 (per r180's mobile-legibility review): the small circular "
        "PLACE inset (r=66) and HARDWARE/SOFTWARE apertures (r=90) read "
        "as portholes in an empty field. Relaid out at r180's own "
        "minimum sizes.",
        "0.0-11.0s  dark map field; a rounded-rectangle PLACE window "
        "(real IMG_6790 @10.0s footage, continuous motion, not frozen), "
        "560x320px > r180's 520x292 minimum, top-left",
        "0.0-1.0s   a path segment lights from the PLACE window's edge to "
        "the big aperture slot, held afterward -- \"transitions motivated "
        "by the path reaching the next node\"",
        "3.0-7.5s   HARDWARE active: one shared big aperture slot "
        "(cx=960,cy=430, r=240 -- 480px diameter > r180's 460px minimum) "
        "shows ai/hero/glasses_hero_chatgpt.jpg (the WHOLE plate scaled "
        "to fit the circle, not a crop), disclosure \"PRODUCT "
        "VISUALIZATION\" at 38px (was 22px), caption \"BORROWED GLASSES "
        "— HARDWARE\" at 52px (was 40px)",
        "7.5-11.0s  SOFTWARE active: same big-aperture slot now shows "
        "ai/worn/product_worn_falls_park_plate_chatgpt.jpg -- a hard cut "
        "at the content swap (not a new geometric position) is the "
        "node-to-node transition here, since r180 asks for \"the active "
        "aperture\" (singular) at this size, same disclosure/caption "
        "treatment",
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
        "r181 (per r180): the three branch apertures (r=130/170/95) read "
        "as \"icons in a diagram\", not proof-of-concept images. Replaced "
        "with a single shared big-aperture slot (cx=1280,cy=470, r=315 -- "
        "630px diameter > r180's 620px minimum) that each example "
        "occupies in turn, entering from a different direction (left / "
        "top / right, eased over 0.5s) -- that difference in entry "
        "direction is what \"distinct entry direction\" actually asks "
        "for, not three separate static positions. The ZONE origin "
        "marker shrinks to a corner (160,150) with one thin connecting "
        "line -- r180's own explicit permission (\"the inactive branch "
        "map may shrink or move aside\").",
        "0.0-5.0s   HISTORICAL: IMG_DAK1.MOV plate fills the big slot, "
        "entering from the left, disclosure \"VISUALIZATION\" at 38px "
        "(was 22px) held continuously, caption \"HISTORICAL "
        "RECONSTRUCTION\" at 52px (was 40px)",
        "5.0-12.5s  ICE AGE: ai/iceage/iceage_falls_visualization_r172_"
        "chatgpt.jpg, push-in 1.04x, entering from the top, same "
        "disclosure/caption treatment, caption \"ICE AGE VISUALIZATION\"",
        "12.5-18.0s AUDIO: real footage still (IMG_6805 @33.0s, dimmed), "
        "entering from the right, no disclosure tag (a real-footage "
        "still, not fabricated imagery), caption \"SPATIAL AUDIO, "
        "SYNCHRONIZED\"",
        "Durations 5.0 / 7.5 / 5.5s are still distinct -- the unequal "
        "rhythm r176 required for v35 and r178 required here is "
        "unchanged; only the apertures' size/position/entry changed.",
    ],
    "loop": [
        "r181 (per r180): the loop diamond (bounding ~300x300) and its "
        "PLACE inset (r=66 circle) were \"physically too small\" and "
        "read as decoration. Relaid out at r180's own minimum dimensions.",
        "0.0-14.0s  dark map field; a rounded-rectangle PLACE window "
        "(same real footage as hwsw), 600x338px == r180's minimum "
        "exactly, top-right -- positioned clear of every node's label "
        "zone and the final caption at every point in the section (see "
        "report for the exact collision-avoidance geometry)",
        "0.0-14.0s  the loop diamond now bounds 1060x630px > r180's "
        "1050x620 minimum. It closes progressively: BORROW (already at "
        "the entry point) -> EXPERIENCE (arrives 3.5s in) -> RETURN "
        "(7.0s) -> UPDATE (10.5s) -> closes back to BORROW (14.0s, this "
        "section's own end)",
        "primary node labels at 52px (was 24px); each node also carries "
        "a supporting phrase (\"Reusable hardware\" / \"Place-based "
        "story\" / \"Destination-managed\" / \"Software changes\") at "
        "38px, shown only in a ~2.1s window around that node's own "
        "arrival -- reads as \"explained one at a time\" as the path "
        "reaches each node, rather than four labels cluttering the "
        "frame simultaneously",
        "13.7-14.0s caption \"BORROW → EXPERIENCE → RETURN → UPDATE\" at "
        "52px (was 40px), appears once the loop is fully closed",
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
    L.append('ORI v36 -- "HOW THE SYSTEM WORKS" (pass 2, r181)')
    L.append("Fourth execution in the operator-ordered five-style slate "
             "(r145__operator__five_style_variants.md); v33/r167 and "
             "v34/r173 are frozen, v35/r177 is visually locked pending "
             "only an operator audio spot-check. r181 rescales hwsw/"
             "examples/loop for mobile legibility per r180's review; "
             "place/zone/close are unchanged (all three PASSED).")
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
             "all -- same discipline v35's r175 established), now at "
             "38px (r181, was 22px). The spatial-audio example carries no "
             "tag because it is a real footage still, not fabricated "
             "imagery. \"SYSTEM DIAGRAM\" is held continuously across "
             "every section per r178's own explicit instruction, so the "
             "animated map is never mistaken for a recording of a "
             "deployed interface -- 26px within hwsw/examples/loop (r181), "
             "20px (unchanged) in place/zone/close.")
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
