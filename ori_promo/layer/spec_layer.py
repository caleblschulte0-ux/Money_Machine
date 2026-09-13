#!/usr/bin/env python3
"""v37 "THE WORLD / THE LAYER" -- spec. Fifth and final execution in the
operator-ordered five-style slate (r145__operator__five_style_variants.md).
v33 (r167), v34 (r173) are frozen; v35 (r177) is visually locked pending
only an operator audio spot-check; v36 (r183) is frozen per r184's
review. r184__chatgpt__v36_final_review_and_v37_direction.md is this
build's brief: a bright editorial TRANSFORMATION film -- the real place
is one visual world, and a decisive landscape-motivated wipe opens a
second, story-bearing layer over that exact place. Not v33's premium
product film, not v34's paper field guide, not v35's chronological
walkthrough, not v36's dark technical system map.

W, H = 1920, 1080, 30fps, full 16:9 (no scope crop -- same reasoning as
every prior style: this isn't reading as cinema either, it's an
explainer).

TOTAL = 74.0s (r184's own target window is 68-76s; its own required
structure sums to exactly 74: 8+12+12+22+12+8=74).

VISUAL LANGUAGE (graphics_layer.py owns the implementation; this is the
brief this build answers to):
  - Bright daylight grade on all real footage -- lifted exposure, a touch
    more saturation than the source -- the opposite treatment from
    v36's dark_doc_grade, and distinct from v34's desaturated paper
    grade and v35's barely-graded natural_grade.
  - ONE saturated accent color (a warm coral-red) used for: the wipe
    boundary line, the zone-trace outline, the anchor pulse, and the
    primary-label scrim boxes. Never used for body/caption text color
    itself (which stays off-white on a dark scrim, for legibility over
    any footage) -- an accent used everywhere stops reading as an
    accent.
  - The core recurring device is wipe_reveal(): a real-footage "WORLD"
    frame and a plate/real "LAYER" frame composited across a moving,
    softly feathered boundary with an accent line at the seam --
    directional (left-to-right for the hook's horizon-following reveal,
    top-to-bottom for the hardware/software unveil, diagonal for the
    ice-age reveal) so no two reveals in the film move the same way.
    This is explicitly NOT v36's circular/rounded-rect aperture and NOT
    v34's static paper card.
  - No system-diagram language, no node/path graph, no persistent
    corner classification tag -- r184 explicitly asks this style to
    avoid v36's "node-map language". The real/visualized boundary is
    communicated by the wipe grammar itself (world vs. layer) plus the
    disclosure tags already required on every generated/product plate.
  - Type is sparse and bold: primary idea labels >=72px, captions
    >=52px, disclosures/secondary labels >=38px -- r184's own explicit
    minimums, given up front rather than needing a follow-up
    legibility pass the way v36 did.

FOOTAGE (raw/ in-points -- reusing windows this handoff has already
verified clean across multiple prior rounds, rather than re-scouting
from zero and re-taking on that risk fresh):
  - IMG_6790 @10.0s (hook, borrow, loop) -- the overlook/railing stretch
    verified clean 10-21s across v36's r179/r181/r183 place+hwsw
    builds, reused here as this style's own "world" baseline.
  - IMG_6790 @20.0s (close) -- the different sub-window v36's own close
    used, so hook/borrow/loop and close aren't the identical footage.
  - IMG_6805 @20.0s (recognize) -- the 20-33s window r181 verified
    clean (one small, consistently-distant background pedestrian,
    judged acceptable, disclosed) and not used by v33/v34/v35 (those
    used 36-58s/70-92s of this same clip).
  - IMG_6805 @33.0s still (examples: audio) -- immediately following the
    recognize window, same clean stretch, same technique v35/v36 used
    for their own spatial-audio segment.
  - IMG_DAK1.MOV (examples: historical) -- the same already-disclosed
    reenactment plate v33/v34/v35/v36 all reuse.
  - ai/iceage/iceage_falls_visualization_r172_chatgpt.jpg (hook +
    examples: ice age) -- r172's supplied plate, same one v34/v35/v36
    reuse.
  - ai/hero/glasses_hero_chatgpt.jpg (borrow: hardware) and
    ai/worn/product_worn_falls_park_plate_chatgpt.jpg (borrow: software)
    -- the same two already-disclosed product plates every prior
    version uses.

GENERATED ASSETS: none new. Per r184's own explicit constraint, Claude
does not generate or fabricate new photographic imagery or video this
round -- only the already-authorized real footage and the existing
ChatGPT plates above, plus code-native wipes/text/graphics.
"""

W, H = 1920, 1080
FPS = 30
TOTAL = 74.0

# Global timestamp where the true held end card begins, for qa.py's
# freeze/black/silence excuse window -- see field/spec_field.py's
# END_CARD_START comment for the general reasoning. render_layer.py's
# build_close(): close section starts at 66.0, dur=8.0, end_dur=3.5, so
# the end card holds from local t=4.5 -- global 66.0+4.5=70.5. qa.py's old
# `dur - 3.0` guess (71.0) is 0.5s late, AND this spec uses SECTIONS
# instead of BEATS (also, map/spec_map.py's TOTAL is the same 74.0 --
# without this constant qa.py's old spec-matching-by-duration could have
# picked either spec's beat data for a video that is actually the other
# one). This is the v37 style currently in production.
END_CARD_START = 70.5

RAW = "../raw"

# (name, start, dur, description)
SECTIONS = [
    ("hook",      0.0,  8.0, "THE WORLD / THE LAYER: a landscape wipe reveals the Ice Age layer"),
    ("borrow",    8.0, 12.0, "BORROW THE LAYER: hardware then software, borrow/return"),
    ("recognize", 20.0, 12.0, "WHEN THE PLACE RECOGNIZES YOU: zone trace + anchor pulse"),
    ("examples",  32.0, 22.0, "SAME PLACE, DIFFERENT STORIES: historical / ice age / audio"),
    ("loop",      54.0, 12.0, "BORROW / EXPERIENCE / RETURN / UPDATE: editorial word sequence"),
    ("close",     66.0,  8.0, "DEFINITION AND CLOSE: layer resolves to real park + end card"),
]

assert abs(sum(s[2] for s in SECTIONS) - TOTAL) < 1e-6

CAPTIONS = {
    "hardware": "BORROWED GLASSES — HARDWARE",
    "software": "PLACE-BASED EXPERIENCE — SOFTWARE",
    "recognize_1": "THE SYSTEM RECOGNIZES WHERE YOU ARE",
    "recognize_2": "AND ANCHORS CONTENT TO THIS EXACT PLACE",
    "historical": "HISTORICAL RECONSTRUCTION",
    "iceage": "ICE AGE VISUALIZATION",
    "audio": "SPATIAL AUDIO, SYNCHRONIZED",
    "close": "OPEN RANGE INTERACTIVE ADDS A STORY LAYER TO REAL PLACES",
}

# loop section: (PRIMARY, sub-phrase) pairs, shown one at a time
LOOP_WORDS = [
    ("BORROW", "the hardware"),
    ("EXPERIENCE", "the story"),
    ("RETURN", "the hardware"),
    ("UPDATE", "the software"),
]

VO_LINES = [
    ("hook", 0.8,
     "Every place has two layers: the world you can see, and the story "
     "Open Range Interactive can add to it."),
    ("borrow", 0.3,
     "You borrow the hardware -- a pair of glasses -- and load a "
     "place-based experience onto it, like software. When you're "
     "finished, the hardware goes back."),
    ("recognize", 0.3,
     "Walk into a bounded zone, and the system recognizes where you "
     "are, anchoring new content to the real landscape in front of "
     "you."),
    ("examples", 0.3,
     "The same spot can hold a historical reconstruction, shift into "
     "an Ice Age landscape, or carry spatial audio that stays "
     "synchronized between everyone standing there."),
    ("loop", 0.3,
     "Borrow the hardware, experience the story, return the hardware "
     "-- and the destination can update the software anytime, without "
     "adding permanent installations."),
    ("close", 0.3,
     "Open Range Interactive: real places, carrying a second story "
     "layer."),
]
