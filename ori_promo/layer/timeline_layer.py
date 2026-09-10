#!/usr/bin/env python3
"""Emit the handoff timeline for v37 "THE WORLD / THE LAYER".

SECTIONS and the narration script are read out of spec_layer.py/
vo_layer.py, not retyped. The per-section SHOT STRUCTURE is a direct
account of render_layer.py's own per-section builder code, written by
reading it.
"""
import sys

sys.path.insert(0, ".")
from spec_layer import SECTIONS, VO_LINES, TOTAL, W, H, FPS

STRUCTURE = {
    "hook": [
        "0.0-8.0s   IMG_6790 @8.0s real footage, bright_edit_grade -- "
        "the film's own daylight treatment (opposite instinct from "
        "map/'s dark_doc_grade)",
        "0.0-1.8s   clean world, no layer -- \"hold clean real footage "
        "for at least 1.5 seconds\" (r184's own beat-1 requirement)",
        "1.8-4.2s   wipe_reveal(direction=ltr): a coral seam sweeps "
        "left-to-right, exposing ai/iceage/iceage_falls_visualization_"
        "r172_chatgpt.jpg (gentle continuous push-in, not a static "
        "hold -- \"movement-led\")",
        "4.2-8.0s   fully revealed Ice Age layer, held",
        "0.2-1.9s   primary_label \"THE WORLD\" (84px, coral scrim)",
        "1.9-8.0s   primary_label \"THE LAYER\" (84px, coral scrim)",
        "1.8-8.0s   disclosure \"VISUALIZATION\" (38px), held "
        "continuously from the instant any layer pixel is visible "
        "through the section's end -- r184's own acceptance test "
        "(\"continuous disclosure at every sampled timestamp, "
        "including entry and exit boundaries\")",
    ],
    "borrow": [
        "0.0-12.0s  IMG_6790 @16.0s real footage, continuous",
        "0.0-1.6s   primary_label \"BORROW THE LAYER\" (84px)",
        "1.5-3.0s   wipe_reveal(direction=ttb): a coral seam sweeps "
        "top-to-bottom (a distinct direction from hook's left-to-"
        "right), exposing ai/hero/glasses_hero_chatgpt.jpg (gentle "
        "push-in)",
        "2.6-7.0s   primary_label \"HARDWARE\" (76px)",
        "1.5-7.0s   disclosure \"PRODUCT VISUALIZATION\", held "
        "continuously while the hero plate is on screen",
        "3.2-7.0s   caption \"BORROWED GLASSES — HARDWARE\"",
        "7.0s       hard cut of layer content (hero -> "
        "ai/worn/product_worn_falls_park_plate_chatgpt.jpg) -- the "
        "wipe stays fully open (progress=1.0), only the content "
        "underneath swaps, the same \"active aperture, singular\" "
        "logic v36's hwsw beat used for its own hardware/software "
        "swap",
        "7.0-11.4s  primary_label \"SOFTWARE\" (76px)",
        "7.0-12.0s  disclosure \"PRODUCT VISUALIZATION\", held "
        "continuously while the worn plate is on screen (including "
        "through the closing wipe's fade)",
        "7.0-11.0s  caption \"PLACE-BASED EXPERIENCE — SOFTWARE\"",
        "11.0-12.0s wipe_reveal closes (progress 1.0 -> 0.0) back to "
        "clean real footage, the cut into the next section",
    ],
    "recognize": [
        "0.0-12.0s  IMG_6805 @20.0s real footage, full-bleed, "
        "continuous -- the 20-33s window v36's r181 verified clean "
        "(one small, consistently-distant background pedestrian, "
        "judged acceptable, disclosed there and still true here)",
        "0.2-1.9s   primary_label \"WHEN THE PLACE RECOGNIZES YOU\" "
        "(62px)",
        "1.8-12.0s  zone_trace: four coral corner brackets mark a "
        "bounded zone -- camera-autofocus/AR-bounding-box language, "
        "deliberately NOT v36's node/path rig, which r184 asks this "
        "style to avoid entirely",
        "3.0-12.0s  anchor_pulse: a coral core dot plus a continuously "
        "expanding, fading ring at the zone's anchor point -- \"an "
        "anchored reveal\"",
        "3.2-7.2s   caption \"THE SYSTEM RECOGNIZES WHERE YOU ARE\"",
        "7.2-11.6s  caption \"AND ANCHORS CONTENT TO THIS EXACT PLACE\"",
        "No GPS/computer-vision/beacon/compass/technical-performance "
        "language anywhere in this section, narration included -- "
        "r184's own explicit instruction.",
    ],
    "examples": [
        "r184's own instruction: three unequal, movement-led "
        "transformations branching off recognize, with clean real-"
        "footage resets between them, each in a DISTINCT reveal "
        "direction/rhythm -- not v35's equal EXPERIENCE holds, not "
        "v36's circular apertures/map branches. Rendered as three "
        "independent parts (examples_hist/ice/audio), each its own "
        "process -- the same harness-timeout-avoidance pattern v36's "
        "examples section established (a single ~660-frame build "
        "kept exceeding the background wall-clock limit there).",
        "0.0-1.0s   HISTORICAL part opens on clean IMG_6805 @24.0s "
        "real footage (reset)",
        "1.0-2.2s   wipe_reveal(direction=ltr): exposes IMG_DAK1.MOV "
        "(the same already-disclosed reenactment plate v33-v36 all "
        "reuse)",
        "1.0-8.0s   disclosure \"VISUALIZATION\", held continuously "
        "from the instant any layer pixel is visible",
        "2.2-8.0s   caption \"HISTORICAL RECONSTRUCTION\"",
        "IMG_DAK1.MOV is exactly 8.0s long -- HISTORICAL's duration "
        "matches the real plate exactly rather than requesting more "
        "than exists; ICE AGE absorbs the other 0.5s below so the "
        "section's total (22.0s) is unchanged.",
        "8.0-9.0s   ICE AGE part opens on clean IMG_6805 @26.0s real "
        "footage (reset)",
        "9.0-10.4s  wipe_reveal(direction=diag): a diagonal seam -- a "
        "distinct direction from historical's left-to-right -- "
        "exposes the Ice Age plate, gentle push-in",
        "9.0-17.5s  disclosure \"VISUALIZATION\", held continuously",
        "10.4-17.5s caption \"ICE AGE VISUALIZATION\"",
        "17.5-18.5s AUDIO part opens on clean IMG_6805 @33.0s real "
        "footage (reset) -- the same still-frame technique v35/v36 "
        "used for their own spatial-audio segment",
        "18.5-22.0s two overlapping anchor_pulse rings (a simple "
        "synchronized-audio visual, not a wipe) -- no disclosure tag, "
        "since this is a real-footage still, not fabricated imagery",
        "18.7-22.0s caption \"SPATIAL AUDIO, SYNCHRONIZED\"",
        "Durations 8.0 / 9.5 / 4.5s (including each part's own reset) "
        "are still distinct -- the unequal rhythm r176/r178/r184 all "
        "require is unchanged in spirit, applied with three genuinely "
        "different reveal mechanisms this time.",
    ],
    "loop": [
        "0.0-12.0s  IMG_6805 @26.0s real footage, full-bleed, "
        "continuous -- no wipe, no text-heavy diagram, \"real footage "
        "and two or three large words at a time\" per r184's own "
        "explicit instruction",
        "0.0-3.0s   \"BORROW\" / \"the hardware\"",
        "3.0-6.0s   \"EXPERIENCE\" / \"the story\"",
        "6.0-9.0s   \"RETURN\" / \"the hardware\"",
        "9.0-12.0s  \"UPDATE\" / \"the software\"",
        "One word pair on screen at a time -- never four nodes "
        "simultaneously the way v36's own loop section did.",
    ],
    "close": [
        "0.0-8.0s   IMG_6790 @22.0s real footage, full-bleed, "
        "continuous -- a different sub-window from hook's own 8.0s "
        "and borrow's own 16.0s in-points on the same 32.0s-long clip",
        "0.0-4.5s   caption \"OPEN RANGE INTERACTIVE ADDS A STORY "
        "LAYER TO REAL PLACES\" -- the \"one concise definition of "
        "ORI\" r184's own beat 6 asks for",
        "4.5-8.0s   end_card \"OPEN RANGE INTERACTIVE\" / \"PLACE-"
        "BASED STORIES, LAYERED ONTO REAL PLACES\", held through the "
        "literal last rendered frame (true no-fade path, the same fix "
        "v35's r175 round landed on and v36 carried forward from the "
        "start -- fade_k's no_out=True flag, not a fresh discovery)",
    ],
}


def main():
    L = []
    L.append('ORI v37 -- "THE WORLD / THE LAYER" (r185)')
    L.append("Fifth and final execution in the operator-ordered five-style "
             "slate (r145__operator__five_style_variants.md); v33/r167, "
             "v34/r173 are frozen, v35/r177 is visually locked pending "
             "only an operator audio spot-check, v36/r183 is frozen per "
             "r184's own review. r184 assigns this style: a bright "
             "editorial transformation film -- the real place is one "
             "visual world, and a decisive landscape-motivated wipe "
             "opens a second, story-bearing layer over that exact place.")
    L.append(f"Running time {TOTAL:.3f}s   {W}x{H} @ {FPS} fps, full 16:9, no scope crop")
    L.append("")
    L.append("SECTION LIST -- generated from spec_layer.py, not retyped")
    L.append("")
    for s, st, d, desc in SECTIONS:
        L.append(f"  {st:5.1f}-{st+d:5.1f}  {s:<10} {desc}")
    L.append("")
    L.append("SHOT STRUCTURE, DISCLOSURE INTERVALS -- read from render_layer.py's own code")
    L.append("")
    for s, st, d, desc in SECTIONS:
        for line in STRUCTURE.get(s, []):
            L.append(f"  {line}")
        L.append("")
    L.append("NARRATION, VERBATIM -- read from vo_layer.py, not retyped "
              "(synthesized offline, piper en_US-lessac-high; no licensed "
              "or cloned voice; a COMPLETELY FRESH script -- sentence "
              "architecture and opening do not reuse v35 or v36, per "
              "r184's explicit instruction)")
    L.append("")
    for sec, off, text in VO_LINES:
        sst = next(s[1] for s in SECTIONS if s[0] == sec)
        L.append(f"  {sst + off:5.1f}s  \"{text}\"")
    L.append("")
    L.append("  No date, no measurement, no attribution, no traction, no "
              "partnership, no deployment claim, no CTA, no GPS/computer-"
              "vision/beacon/compass/precision/latency implementation "
              "detail -- all explicitly ruled out by r184, same as r178 "
              "before it.")
    L.append("")
    L.append("STANDING DISCLOSURE")
    L.append("  \"VISUALIZATION\" over the Ice Age plate (hook, examples) "
             "and the historical reenactment plate (examples); "
             "\"PRODUCT VISUALIZATION\" over the hero-glasses and worn "
             "plates (borrow). All held CONTINUOUSLY for their complete "
             "on-screen interval (disclosure() defaults to fixed k=1.0, "
             "no fade envelope at all -- same discipline v35's r175 "
             "established, carried forward by every style since), at "
             "38px -- r184's own minimum, given from the first pass "
             "rather than needing a follow-up legibility round the way "
             "v36 did. The spatial-audio example carries no tag because "
             "it is a real-footage still, not fabricated imagery. No "
             "system-diagram tag or node/path language anywhere in this "
             "style, per r184's own explicit instruction to avoid v36's "
             "\"node-map language\" -- the real/visualized boundary is "
             "communicated by the wipe grammar itself (world vs. layer) "
             "plus these disclosure tags.")
    L.append("")
    L.append("SOUND")
    L.append("  Narration only -- no score, no sound effects. r184's "
             "brief doesn't ask for one; adding invented sound design "
             "without that being asked for would be scope creep, the "
             "same judgment call every prior style in this slate has "
             "made when not explicitly asked otherwise.")
    print("\n".join(L))


if __name__ == "__main__":
    main()
