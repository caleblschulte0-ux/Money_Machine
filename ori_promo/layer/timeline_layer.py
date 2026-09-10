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
        "1.8-4.2s   windowed_reveal(direction=ltr, r197): the real "
        "footage stays full-bleed at every value of progress -- a "
        "bracket-framed floating AR window (recognize's own zone_trace "
        "geometry) sweeps open over the LEFT side of frame, exposing "
        "ai/iceage/iceage_falls_visualization_r172_chatgpt.jpg inside "
        "the window only, never the whole picture; a coral seam marks "
        "the sweep's leading edge while it is mid-open (replaces r185's "
        "wipe_reveal, a full-frame crossfade to an unrelated photo -- "
        "the operator's direct complaint: \"we cut to an AI image, it's "
        "out of place... it doesn't give the feel... you walk around "
        "with glasses and you see stuff\")",
        "4.2-8.0s   window fully open (progress=1.0), held -- real "
        "footage (the boy, on the RIGHT of frame) stays visible beside "
        "it the whole time",
        "0.2-1.9s   primary_label \"THE WORLD\" (84px, white -- r197, "
        "was coral; see STANDING TYPOGRAPHY)",
        "1.9-8.0s   primary_label \"THE LAYER\" (84px, white, thin "
        "coral rule beneath -- r197, was solid coral fill)",
        "1.8-8.0s   disclosure \"VISUALIZATION\" (38px), held "
        "continuously from the instant any layer pixel is visible "
        "through the section's end -- r184's own acceptance test "
        "(\"continuous disclosure at every sampled timestamp, "
        "including entry and exit boundaries\")",
    ],
    "borrow": [
        "0.0-12.0s  IMG_6790 @16.0s real footage, continuous",
        "0.0-1.6s   primary_label \"BORROW THE LAYER\" (84px, white, "
        "soft scrim, no box -- r189; every non-hook label lost its "
        "coral fill this round, see STANDING TYPOGRAPHY below)",
        "1.5-3.0s   windowed_reveal(direction=ttb, r197): the AR window "
        "opens top-to-bottom over the LEFT side of frame (the boy stays "
        "visible on the right, walking the same real overlook), "
        "exposing ai/hero/glasses_hero_chatgpt.jpg inside the window "
        "(replaces r185's wipe_reveal)",
        "2.6-7.0s   primary_label \"HARDWARE\" (76px, white, no box)",
        "1.5-7.0s   disclosure \"PRODUCT VISUALIZATION\", held "
        "continuously while the hero plate is on screen",
        "3.2-7.0s   caption \"BORROWED GLASSES — HARDWARE\"",
        "7.0s       hard cut of window content (hero -> "
        "ai/worn/product_worn_falls_park_plate_chatgpt.jpg) -- the "
        "AR window stays fully open (progress=1.0), only the content "
        "inside it swaps, the same \"active aperture, singular\" "
        "logic v36's hwsw beat used for its own hardware/software "
        "swap. This is the exact frame the operator called out by name "
        "(\"there's just that one random picture of an AI model who we "
        "never see again\"): the worn-glasses model now reads as a "
        "framed reference window beside the boy, not a disorienting "
        "full-frame cut to a stranger",
        "7.0-11.4s  primary_label \"SOFTWARE\" (76px, white, no box)",
        "7.0-12.0s  disclosure \"PRODUCT VISUALIZATION\", held "
        "continuously while the worn plate is on screen (including "
        "through the closing sweep)",
        "7.0-11.0s  caption \"PLACE-BASED EXPERIENCE — SOFTWARE\"",
        "11.0-12.0s AR window closes (progress 1.0 -> 0.0) back to "
        "clean real footage, the cut into the next section",
    ],
    "recognize": [
        "0.0-12.0s  IMG_6805 @20.0s real footage, full-bleed, "
        "continuous -- the 20-33s window v36's r181 verified clean "
        "(one small, consistently-distant background pedestrian, "
        "judged acceptable, disclosed there and still true here)",
        "0.2-1.9s   primary_label \"WHEN THE PLACE RECOGNIZES YOU\" "
        "(72px -- r187, was 62px; r186 caught this against r184's own "
        "72px primary-label minimum, the only miss in that review. "
        "r189: white, soft scrim, no box, same size/position/wording)",
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
        "1.0-2.2s   windowed_reveal(direction=ltr, r197): the AR window "
        "opens over the LEFT side of frame, exposing IMG_DAK1.MOV (the "
        "same already-disclosed reenactment plate v33-v36 all reuse) "
        "while the SAME real waterfall stays visible on the right -- "
        "directly answers the operator's own comparison (\"when we cut "
        "to the native family, that's at least a hard cut... still "
        "sucks\"): it is no longer a cut at all, real and reenacted "
        "footage of the same place sit side by side",
        "1.0-8.0s   disclosure \"VISUALIZATION\", held continuously "
        "from the instant any layer pixel is visible",
        "2.2-8.0s   caption \"HISTORICAL RECONSTRUCTION\"",
        "IMG_DAK1.MOV is exactly 8.0s long -- HISTORICAL's duration "
        "matches the real plate exactly rather than requesting more "
        "than exists; ICE AGE absorbs the other 0.5s below so the "
        "section's total (22.0s) is unchanged.",
        "8.0-9.0s   ICE AGE part opens on clean IMG_6805 @26.0s real "
        "footage (reset)",
        "9.0-10.4s  windowed_reveal(direction=diag, r197): the AR "
        "window opens on a diagonal sweep -- a distinct direction from "
        "historical's left-to-right -- exposing the Ice Age plate "
        "inside the window while the same real falls stay visible "
        "beside it",
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
        "explicit instruction. r193: a gentle continuous push-in "
        "(1.00x -> 1.07x across the section, center-crop on the "
        "already-loaded frame) -- the source clip is close to "
        "locked-off, and this was the only full-bleed section with no "
        "camera motion at all across a full 12s.",
        "0.0-3.0s   \"BORROW\" / \"the hardware\"",
        "3.0-6.0s   \"EXPERIENCE\" / \"the story\"",
        "6.0-9.0s   \"RETURN\" / \"the hardware\"",
        "9.0-12.0s  \"UPDATE\" / \"the software\"",
        "One word pair on screen at a time -- never four nodes "
        "simultaneously the way v36's own loop section did. r197: the "
        "sub-caption (\"the hardware\"/\"the story\"/etc.) is now white, "
        "was coral -- see STANDING TYPOGRAPHY.",
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
    L.append('ORI v37 -- "THE WORLD / THE LAYER" (AR-window rework, r197)')
    L.append("Fifth and final execution in the operator-ordered five-style "
             "slate (r145__operator__five_style_variants.md); v33/r167, "
             "v34/r173 are frozen, v35/r177 is visually locked pending "
             "only an operator audio spot-check, v36/r183 is frozen per "
             "r184's own review. r186/r188 passed and froze this style's "
             "picture on ChatGPT's own rubric. The operator then looked at "
             "the delivered film directly and called it out: every label, "
             "caption and disclosure sat inside a hard-edged solid-fill "
             "rectangle -- a chyron/lower-third convention, not how a "
             "premium product film sets type, and coral filled every "
             "single label rather than reading as a rare accent. r189 "
             "rewrote graphics_layer.py to replace every box with a soft "
             "feathered scrim and blurred-halo text, and reserved coral "
             "for the hook's own title toggle only. r190 approved that "
             "direction but found it overcorrected: plain white type with "
             "only a soft halo washed out over pale sky, snow, bright "
             "concrete and bright hair. r191 strengthens the local scrims, "
             "front-loads the bottom-edge gradient's rise, and adds a "
             "crisp keyline stroke under the halo on every disclosure and "
             "caption, plus the end card (now white on both lines, coral "
             "reserved for the separator rule) -- still boxless, now "
             "legible over any background. r192 reviewed r191 and froze "
             "v37's picture on ChatGPT's own rubric. r193 is a further "
             "self-directed craft pass, not a response to a flagged "
             "review finding: the operator asked to keep improving the "
             "look, and this session's own fresh re-watch found the loop "
             "section (54.0-66.0s) was the one full-bleed section in the "
             "film with zero camera motion for its whole 12s -- every "
             "other full-bleed section's footage carries some inherent "
             "camera movement, this one reads close to locked-off. "
             "build_loop() now applies a gentle continuous push-in "
             "(1.00x -> 1.07x across the section) directly on the real "
             "footage -- the same device this film's own wipes already "
             "use on its AI plates. No footage swap, no wording, no "
             "disclosure, no timing, and the 74.000s runtime are "
             "unchanged; only the loop section's camera motion. r194 "
             "reviewed r193 and updated the v37 picture freeze to it. "
             "The operator then said 'the whole vibe' was still off. "
             "Every prior report for this style claimed 'narration only, "
             "no score -- the same judgment call every prior style in "
             "this slate has made' -- that was never actually checked: "
             "v33 (one/) and v34 (field/) both ship a synthesized, "
             "license-clean score, wired the same way this build now "
             "wires score_layer.py. r195 adds that score (bright C-G-Am-F "
             "progression, quiet under the hook's own wipe reveal, a "
             "swell under the richest section (examples), easing back "
             "for the loop's four words, released before the end card) "
             "mixed under narration exactly like field/assemble_field.py "
             "mixes its own. Picture is pixel-identical to r193; only "
             "the audio changed.")
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
             "plus these disclosure tags. r189: rendered as tracked "
             "small-caps with a soft halo instead of a dark box -- reads "
             "as an integrated credit line now, same words, same "
             "interval, same 38px minimum, same corner position. r191 "
             "(r190's finding): the tracked white letters nearly "
             "disappeared over pale sky/snow with only a halo behind "
             "them -- added a feathered local scrim and a crisp keyline "
             "stroke; still boxless, same words/interval/size/position, "
             "now legible over any background.")
    L.append("")
    L.append("STANDING TYPOGRAPHY (r189, legibility-corrected r191)")
    L.append("  Every text element in r185-r188's delivered cut sat inside "
             "a hard-edged solid-fill rectangle -- primary labels in a "
             "coral box, captions in a black bar, the loop words in a "
             "black chip, the end card in a black card. That reads as a "
             "chyron/lower-third convention (news captions, corporate "
             "training video), not how a premium product film sets type, "
             "and it was the operator's own direct catch, not a ChatGPT "
             "review finding -- r186/r188 graded this film against r184's "
             "numeric minimums and never flagged the box treatment "
             "itself. graphics_layer.py now replaces every box with a "
             "soft feathered scrim (a blurred alpha patch, not a hard "
             "edge) and blurred-halo text (a soft dark duplicate of the "
             "glyphs behind the crisp glyphs -- the same legibility a box "
             "gave, without the box). Coral is now reserved for the "
             "hook's own \"THE WORLD\"/\"THE LAYER\" title toggle; every "
             "other beat's primary label (BORROW THE LAYER, HARDWARE, "
             "SOFTWARE, WHEN THE PLACE RECOGNIZES YOU) is clean white, so "
             "the accent reads as a rare, designed moment instead of a "
             "wash of red on every frame. No footage, wipe, disclosure "
             "wording, caption wording, narration, timing, section "
             "boundary, or the 74.000s runtime changed -- only how the "
             "type renders. Zone-trace brackets and the anchor pulse are "
             "unchanged (they were never boxed text).")
    L.append("  r191 (r190's own finding, timestamped): plain white type "
             "with only a soft halo washed out at 5.6-7.0s and 42.8-49.0s "
             "(the VISUALIZATION disclosure over pale sky/snow), "
             "16.8-18.2s (PRODUCT VISUALIZATION over bright hair/sky), "
             "22.8-30.8s and 33.6-39.2s and 66.0-69.2s (bottom captions "
             "over bright grass/river-rock/concrete), and 70.6-73.9s (the "
             "end card's coral second line over the bright overlook). "
             "disclosure() and caption() now add a feathered local scrim "
             "(disclosure) or a front-loaded bottom-edge gradient "
             "(caption) plus a crisp 2px dark keyline stroke under the "
             "existing soft halo -- still no hard rectangle, contrast "
             "held over any background. end_card()'s second line is now "
             "white instead of coral (coral reserved for the separator "
             "rule alone) with a stronger local scrim. Primary labels, "
             "loop words, and the zone-trace/anchor-pulse graphics were "
             "not touched -- r190 asked to preserve them, and this "
             "session's own re-check of the r189 delivery found them "
             "already legible. Font sizes, wording, timing, positions, "
             "and the 74.000s runtime are unchanged.")
    L.append("  r197 (operator direct note: \"that orange text color... "
             "it's ugly, it sucks\"): coral is now reserved ENTIRELY for "
             "geometric elements -- thin rule lines, corner brackets, "
             "the AR-window wipe seam, the anchor-pulse dot/ring -- "
             "never a text/glyph fill, on any call, anywhere in the "
             "style. primary_label() renders every label in white "
             "regardless of its accent_bg argument; accent_bg=True (the "
             "hook's own \"THE WORLD\"/\"THE LAYER\" toggle) now adds "
             "only a thin coral rule beneath the white text, not a "
             "colored glyph fill. loop_word()'s sub-caption "
             "(\"the hardware\"/\"the story\"/etc.) is white, was coral. "
             "end_card() was already fixed to white-on-both-lines in "
             "r191 and is untouched this round. Re-rendered: hook, "
             "borrow (both had accent_bg defaulting True on \"THE "
             "WORLD\"/\"THE LAYER\"/\"HARDWARE\"/\"SOFTWARE\"), "
             "recognize and loop (their own label calls already passed "
             "accent_bg=False, so their text was already white before "
             "this round -- re-rendered anyway to confirm, byte-size-"
             "identical output on recognize confirms no regression). "
             "examples_audio and close use no primary_label/loop_word "
             "call and needed no re-render.")
    L.append("")
    L.append("STANDING AR GRAMMAR (new this round, r197)")
    L.append("  Operator direct critique, verbatim: \"we cut to an AI "
             "image, it's out of place... you fade to a place that's "
             "not... anything to do with the guy... there's just that "
             "one random picture of an AI model who we never see again, "
             "so much AI slop... it doesn't give the feel, it's supposed "
             "to be a very streamlined feel -- you walk around with "
             "glasses and you see stuff. All these hard cuts and places "
             "that people aren't walking around, they have no life, no "
             "pathos, no ethos.\" Root cause: every AI/product reveal in "
             "r185-r195 used wipe_reveal(), a FULL-FRAME crossfade that "
             "swapped the entire picture to an unrelated photo -- a "
             "different place, a different person, sometimes a "
             "different person's face entirely (the worn-glasses model "
             "at 7.0-11.4s). That is structurally backwards for a "
             "\"you walk around with AR glasses\" film: the real place "
             "should never disappear. windowed_reveal() (graphics_"
             "layer.py) replaces it everywhere (hook, borrow, "
             "examples_hist, examples_ice -- 4 call sites, wipe_reveal "
             "itself deleted, zero callers left): the real world stays "
             "full-bleed at EVERY value of progress; the AI/product "
             "content only ever appears inside a floating window, "
             "bracket-framed with the EXACT SAME corner-bracket drawing "
             "and geometry recognize's own zone_trace already uses "
             "(reused deliberately -- the whole film now reads as one "
             "consistent AR system, not a different effect per section), "
             "soft drop shadow, directional reveal sweep confined to the "
             "window's own bounds, coral seam at the sweep's leading "
             "edge while mid-open. The boy protagonist (hook/borrow) and "
             "the falls themselves (examples) stay visible beside the "
             "window at every timestamp checked -- no collision with "
             "the disclosure tag (top-right) or the bottom captions in "
             "any re-rendered section, confirmed on real frame grabs, "
             "not just the synthetic smoke test windowed_reveal() was "
             "unit-tested against before wiring it in. Window geometry "
             "(WIN_CX/CY/W/H in graphics_layer.py) is a direct constant "
             "copy of recognize's ZONE_CX/CY/W/H in render_layer.py -- "
             "one AR window position/size for the whole film. Not fixed "
             "by this round, and not attempted: hook/borrow/close use "
             "IMG_6790 (the boy is on screen); recognize/examples/loop "
             "use IMG_6805, a different, peopleless landscape clip. A "
             "single continuous protagonist across all six sections "
             "would require different footage selection, not a "
             "compositing change, and is out of scope here.")
    L.append("")
    L.append("SOUND")
    L.append("  r195: narration plus a synthesized score (score_layer.py) "
             "-- no sample, nothing licensed, regenerable from source at "
             "any length. Bright C-G-Am-F progression, 96 BPM, mixed under "
             "narration at weight 0.55 vs. the voice's 1.0 (the same "
             "balance field/assemble_field.py's own mix uses). Quiet "
             "under the hook's clean-footage open, lifts through the "
             "wipe reveal (1.8-4.2s), sustains through borrow/recognize, "
             "swells under examples (32.0-54.0s, the richest passage), "
             "eases back for the loop's four words so they aren't "
             "fighting a swell, and releases before the end card. r185- "
             "r193 all claimed this was 'the same judgment call every "
             "prior style in this slate has made' -- that was never "
             "checked against the other four builds: v33 (one/) and v34 "
             "(field/) both ship a score already, wired the same way. "
             "Measured -16.55 LUFS integrated / -1.94 dBTP true peak "
             "(no clipping: volumedetect max_volume -1.5 dB, right at "
             "the limiter's own ceiling). This session has no audio "
             "playback capability, so the mix's musical/emotional fit "
             "is not something it can verify by ear -- only that the "
             "signal is present, level-matched, and clean. ChatGPT's "
             "r196 async review (reading r195's Drive files, not this "
             "chat) recommended freezing picture pending an operator "
             "audio listening verdict on r195 -- written before the "
             "operator's own direct critique below arrived; r197 "
             "supersedes that hold on the operator's explicit, more "
             "recent instruction to rework the picture. r195's score "
             "and its open six-part audio spot-check are both carried "
             "forward untouched by this round.")
    L.append("")
    L.append("R197 -- THE OPERATOR'S DIRECT 5-SCREENSHOT CRITIQUE")
    L.append("  The operator watched the delivered r195 film and gave "
             "detailed, specific feedback with 5 screenshots, naming two "
             "problems: (1) \"that orange text color... nothing "
             "professional about it... it just got slapped on there\"; "
             "(2) every AI/product cutaway was a full-frame swap to a "
             "totally unrelated photo/place/person -- \"we cut to an AI "
             "image, it's out of place,\" \"there's just that one random "
             "picture of an AI model who we never see again... so much "
             "AI slop,\" \"these fades... you fade to a place that's not "
             "not where the guy standing, not anything to do with the "
             "guy.\" The structural point: \"it doesn't give the feel. "
             "It's supposed to be a very streamlined feel -- you walk "
             "around with glasses like the guy's doing in my videos and "
             "you see stuff. All these hard cuts and places that people "
             "aren't walking around, they have no life, no pathos, no "
             "ethos.\" Both are fixed in this round -- see STANDING "
             "TYPOGRAPHY and STANDING AR GRAMMAR below -- using only "
             "already-approved assets recomposited differently; no new "
             "image/video was generated (standing rule: Claude never "
             "generates imagery, ChatGPT only).")
    print("\n".join(L))


if __name__ == "__main__":
    main()
