#!/usr/bin/env python3
"""v35 "THE WALKTHROUGH" -- spec. Third execution in the operator-ordered
five-style slate (r145__operator__five_style_variants.md). v33 is the
cinematic/emotional explainer (frozen, r167). v34 is the bright museum
field guide (frozen, r173). v35 must be a third, unmistakably different
execution per r174__chatgpt__v35_walkthrough_direction.md: a chronological
visitor walkthrough, ARRIVE -> BORROW -> WALK -> RECOGNIZE -> EXPERIENCE ->
RETURN -> CLOSE, natural sound, minimal white-text graphics -- explicitly
NOT v33's scope-crop/HUD grammar and NOT v34's paper panels/split
screens/numbered step strip/ochre palette.

W, H = 1920, 1080. Full 16:9, same as v34 (r174 doesn't ask for a scope
crop and the whole point of this style is NOT reading as cinema).

TOTAL = 72.0s (r174's target window was 68-75s; 7+9+10+12+16+10+8=72).

FOOTAGE. Reuses this project's own raw/ library at IN-POINTS neither v33
nor v34 used, scouted and visually verified (see check/scout2/ grids from
this round):
  - IMG_6790 @0.6s (ARRIVE) -- the clip's own opening seconds, checked
    frame-by-frame: 0.0-0.6s has a finger/thumb passing in front of the
    lens (someone's hand near the camera as recording started), clear by
    0.6s -- v33/v34 both start their own use of this clip later (5.0s+),
    so this is still a fresh stretch.
  - IMG_6805 @38.0s (WALK) -- verified our own recurring visitor (brown
    horse-graphic shirt, red shorts) actually walking away down the
    curved path for a good ~20s stretch (36-56s); v34 only uses this
    clip's later locked-off empty wide (19.0-25.0s) and its early
    stretch has unrelated bystanders (jogger + dog-walker) crossing the
    frame, both avoided here.
  - IMG_6805 @48.0s (RETURN) -- the same walking stretch, further along
    (he is smaller/more distant) -- a truthful way to visually suggest
    the walk ending/him heading back without staging a fake handoff shot
    that doesn't exist (r174 explicitly says not to imply a literal
    handoff/return action without matching footage; narration alone
    carries "the glasses go back").
  - IMG_6805 @70.0s (CLOSE) -- the same locked-off empty wide used by
    v34's close (elsewhere in this take), at a different in-point -- real
    continuous motion (the falls keep moving), not a frozen hold, per
    r174's explicit "finish on real moving footage" requirement.
  - IMG_6806 @45.0s (RECOGNIZE) -- re-scouted at 1s intervals across the
    FULL 59.5s clip after a first pass (3s intervals) wrongly judged
    18.0s clean: a bystander (woman with a backpack) is actually in frame
    continuously through roughly 0-27s. Verified clean from ~30s onward;
    45.0-57.0s sits inside that confirmed-clean stretch and does not
    overlap v34's own 33.0-45.0s window.

GENERATED ASSETS REUSED (never regenerated -- same standing rule as v33
and v34: Claude never generates images/video, only reuses ChatGPT's
already-supplied, already-disclosed assets):
  - ai/hero/glasses_hero_chatgpt.jpg ("PRODUCT VISUALIZATION")
  - raw/IMG_WORN1.MOV's source photo, re-encoded at THIS beat's own
    duration via the same build_worn_long-style zoompan reuse pattern
    already used once for v34 ("PRODUCT VISUALIZATION")
  - raw/IMG_DAK1.MOV (Dakota reconstruction plate, "VISUALIZATION")
  - ai/iceage/iceage_falls_visualization_r172_chatgpt.jpg (the r172 Ice
    Age Falls Park plate ChatGPT supplied for v34's own gap, explicitly
    named for reuse here by r174 itself, "VISUALIZATION")

DISCLOSURE HELD CONTINUOUSLY, BY DESIGN THIS TIME -- r174's own editorial
acceptance criterion #4 ("every generated/reconstructed frame has its
required persistent disclosure through the final frame of its interval")
and the format section ("must say ... continuously") are explicit up
front. v34 only reached a continuous (non-fading) disclosure tag after
r172 asked for a specific fix; here every disclosure tag is built with
that same "hold true, no shared fade-in/out envelope" behavior from the
start, not fixed after the fact.

NATURAL SOUND, NOT SYNTHESIZED SCORE -- v35 has no score_walk.py. r174
asks specifically for "footsteps, water, wind, fabric movement" location
sound bridges, not music; every raw/IMG_*.MOV clip this project shot
carries its own real AAC location audio track (verified via ffprobe).
Short natural-sound snippets are pulled directly from the SAME in-point
already chosen for each beat's picture (so sound and image match), only
in the brief windows r174 itself scoped (~2s before narration settles at
the open, one or two short accents bridging cuts elsewhere) -- not
continuously under the whole film. This project's own standing note (the
operator: "there's a lot of me talking in the background") is why this
stays brief and low-level rather than an open location mic for 72
seconds; see vo_walk.py's header for the specific treatment.
"""

W, H = 1920, 1080
FPS = 30
TOTAL = 72.0

# Global timestamp where the true held end card begins, for qa.py's
# freeze/black/silence excuse window -- see field/spec_field.py's
# END_CARD_START comment for why this isn't just "close beat start" or a
# guessed `dur - 3.0`. build_close()'s close beat starts at 64.0 and holds
# the end card for its final end_dur=3.0s, so this happens to equal the
# old `dur - 3.0` guess exactly (69.0 either way) -- unlike field/map/layer,
# where that guess is measurably wrong. Recorded explicitly anyway so qa.py
# has one consistent mechanism across every spec instead of one that works
# by coincidence here and by luck nowhere else.
END_CARD_START = 69.0

RAW = "../raw"

# (name, start, dur, description)
BEATS = [
    ("arrive",     0.0,  7.0,  "real approach footage, modest title card"),
    ("borrow",     7.0,  9.0,  "glasses detail -> match cut to worn plate, HARDWARE/SOFTWARE"),
    ("walk",      16.0, 10.0,  "visitor walking the route, thin progress line"),
    ("recognize", 26.0, 12.0,  "recognizes the zone, anchors content to place"),
    ("experience",38.0, 16.0,  "three examples: historical / ice-age / spatial audio"),
    ("return",    54.0, 10.0,  "destination model: site-based, reusable, updateable"),
    ("close",     64.0,  8.0,  "real moving footage, end card in the final ~3s"),
]

assert abs(sum(b[2] for b in BEATS) - TOTAL) < 1e-6

# progress line runs 0.0 (arrive start) -> 64.0 (return end); close carries
# no progress line per r174 (only ARRIVE/WALK/RECOGNIZE/EXPERIENCE/RETURN
# are the labeled arc stops in the brief's own shot structure)
PROGRESS_START = 0.0
PROGRESS_END = 64.0

VO_LINES = [
    ("arrive", 1.8,
     "You arrive at Falls Park and borrow a pair of glasses."),
    ("borrow", 0.3,
     "The glasses are the hardware. The experience running on them is the "
     "software, built for this specific place."),
    # TIGHTENED from r174's exact line ("You put them on and follow a route
    # through the park. There is nothing to buy or keep. When the walk is
    # over, the glasses go back.") -- measured against a 10.0s beat, the
    # original ran to ~10.0s of synthesized audio against a ~9.4s speaking
    # budget (offset 0.3, margin), which is exactly the overrun class v34's
    # r171 hit on its `system` line. Same fix: same claims, fewer words.
    # r174 pre-authorizes this ("Claude may tighten wording only if measured
    # synthesis overruns its assigned picture... disclose the change").
    ("walk", 0.3,
     "You put them on and follow a route through the park. Nothing to buy "
     "or keep -- when the walk ends, the glasses go back."),
    ("recognize", 0.3,
     "As you enter each experience zone, the system recognizes where you "
     "are and anchors digital content to the real landscape."),
    ("experience", 0.3,
     "A historical reconstruction can appear where the story happened. "
     "The falls can shift into an Ice Age visualization. Spatial audio "
     "can move with the scene and stay synchronized between visitors."),
    ("return", 0.3,
     "The destination manages the reusable hardware and updates the "
     "place-based software, without filling the park with permanent "
     "installations."),
    ("close", 0.3,
     "Open Range Interactive turns a visit into a guided story, "
     "experienced where it belongs."),
]
