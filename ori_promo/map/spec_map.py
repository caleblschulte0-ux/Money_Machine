#!/usr/bin/env python3
"""v36 "HOW THE SYSTEM WORKS" -- spec. Fourth execution in the operator-
ordered five-style slate (r145__operator__five_style_variants.md). v33
(r167), v34 (r173) are frozen; v35 (r177) is visually locked pending only
an operator audio spot-check. r178__chatgpt__v36_system_map_direction.md
is this build's brief: a dark, animated SYSTEM MAP -- a premium tech-
documentary "opening up the machine", not a visitor diary (v35), a paper
field guide (v34), or a cinematic reveal (v33).

W, H = 1920, 1080, 30fps, full 16:9 (no scope crop -- same reasoning as
v34/v35: this style isn't reading as cinema either).

TOTAL = 74.0s (r178's target window is 68-76s; 7+11+13+18+14+11=74).

VISUAL LANGUAGE (graphics_map.py owns the implementation; this is the
brief this build answers to):
  - near-black/graphite field, off-white type
  - ONE cool signal color (pale cyan) for the active path
  - ONE warm accent (muted amber) for physical-PLACE nodes only (PLACE,
    ZONE) -- every other node (HARDWARE, SOFTWARE, the three EXAMPLES,
    the four LOOP nodes) is neutral off-white/cyan, not amber, since
    they aren't physical locations
  - ONE persistent path travels the whole film: straight-line segments
    between fixed waypoints, glowing cyan once "reached", dim grey where
    not yet reached -- a traveled/untraveled state a viewer can read at a
    glance, and the literal mechanism r178 asks transitions to be
    "motivated" by (a node lights up exactly when the path's tip reaches
    it)
  - real footage appears two ways: SMALL circular apertures on the dark
    map field (the persistent PLACE anchor, HARDWARE/SOFTWARE/EXAMPLES
    insets), and FULL-BLEED (edge-to-edge, no visible mask) at PLACE's
    open, ZONE's recognize/anchor passage, and the close -- exactly
    where r178 asks footage to "remain recognizable and materially
    present", not decorative
  - "SYSTEM DIAGRAM" sits in a discreet corner whenever the animated map
    is the dominant visual, per r178's own explicit instruction, so it
    is never mistaken for a real interface recording

FOOTAGE (raw/ in-points; freshness isn't a stated r178 requirement the
way it was for v35, but distinct in-points were still chosen where a
clean one was available):
  - IMG_6790 @10.0s (PLACE, open) -- a verified-clean stretch (8-27s)
    of the overlook platform, our recurring visitor present.
  - IMG_6790 @20.0s (CLOSE) -- a different sub-window of the same clean
    stretch, so open and close aren't the identical clip.
  - IMG_6805 @20.0s (ZONE / RECOGNIZE-ANCHOR, persistent PLACE inset) --
    verified clean and NOT used by any of v33/v34/v35 (those used
    36-58s and 70-92s of this same clip; this is the 16-36s window,
    minus a jogger passing at ~16-18s, avoided by starting at 20.0s).
  - IMG_DAK1.MOV (HISTORICAL example) -- same already-disclosed plate
    v33/v34/v35 all reuse.
  - ai/iceage/iceage_falls_visualization_r172_chatgpt.jpg (ICE AGE
    example) -- r172's supplied plate, same one v34/v35 reuse.
  - ai/hero/glasses_hero_chatgpt.jpg (HARDWARE) and
    ai/worn/product_worn_falls_park_plate_chatgpt.jpg (SOFTWARE) -- the
    same two already-disclosed product plates every prior version uses.
  - AUDIO example reuses a still frame of IMG_6805 @33.0s (immediately
    following the ZONE footage, same clean window) for its diagram
    background, same technique as v35's spatial-audio segment.

GENERATED ASSETS: none new. Per r178's own explicit constraint, Claude
does not generate or fabricate new photographic imagery or video this
round -- only the already-authorized real footage and the existing
ChatGPT plates above, plus code-native lines/nodes/masks/typography.
"""

W, H = 1920, 1080
FPS = 30
TOTAL = 74.0

RAW = "../raw"

# (name, start, dur, description)
SECTIONS = [
    ("place",       0.0,  7.0, "full-bleed real footage; PLACE node appears"),
    ("hwsw",        7.0, 11.0, "path reaches HARDWARE then SOFTWARE nodes"),
    ("zone",       18.0, 13.0, "path reaches ZONE; full-bleed recognize/anchor"),
    ("examples",   31.0, 18.0, "three unequal branches: historical/ice-age/audio"),
    ("loop",       49.0, 14.0, "map simplifies to the closed operating loop"),
    ("close",      63.0, 11.0, "map fades; real footage resolves; end card"),
]

assert abs(sum(s[2] for s in SECTIONS) - TOTAL) < 1e-6

# ---- diagram layout: fixed waypoints in screen space ----------------
# The "spine" the path travels, in order. Each entry: (x, y, label,
# color_key, kind). color_key in {"amber","neutral"}; kind in
# {"place","product","zone","example","loop"} (used to pick aperture
# size/behavior in render_map.py, not just cosmetic).
# node tuples: (x, y, short_ring_label, color_key, kind). The short label
# is what draw_node() puts on the ring itself; the fuller descriptive
# phrase (CAPTIONS below) is what graphics_map.caption() shows at the
# bottom while that node is the current focus -- kept separate so a long
# phrase never has to fit inside a small ring label.
NODE_PLACE      = (300,  780, "PLACE",         "amber",   "place")
NODE_HARDWARE   = (620,  420, "HARDWARE",      "neutral", "product")
NODE_SOFTWARE   = (960,  420, "SOFTWARE",      "neutral", "product")
NODE_ZONE       = (1300, 620, "ZONE",          "amber",   "zone")
NODE_HISTORICAL = (1080, 260, "HISTORICAL",    "neutral", "example")
NODE_ICEAGE     = (1300, 190, "ICE AGE",       "neutral", "example")
NODE_AUDIO      = (1560, 300, "SPATIAL AUDIO", "neutral", "example")

LOOP_CENTER = (1550, 780)
LOOP_R = 150
NODE_BORROW     = (LOOP_CENTER[0] - LOOP_R, LOOP_CENTER[1],          "BORROW",     "neutral", "loop")
NODE_EXPERIENCE = (LOOP_CENTER[0],          LOOP_CENTER[1] - LOOP_R, "EXPERIENCE", "neutral", "loop")
NODE_RETURN     = (LOOP_CENTER[0] + LOOP_R, LOOP_CENTER[1],          "RETURN",     "neutral", "loop")
NODE_UPDATE     = (LOOP_CENTER[0],          LOOP_CENTER[1] + LOOP_R, "UPDATE",     "neutral", "loop")

SPINE = [NODE_PLACE, NODE_HARDWARE, NODE_SOFTWARE, NODE_ZONE]
BRANCHES = [NODE_HISTORICAL, NODE_ICEAGE, NODE_AUDIO]
LOOP_NODES = [NODE_BORROW, NODE_EXPERIENCE, NODE_RETURN, NODE_UPDATE]

CAPTIONS = {
    "hardware": "BORROWED GLASSES — HARDWARE",
    "software": "PLACE-BASED EXPERIENCE — SOFTWARE",
    "zone": "EXPERIENCE ZONE",
    "historical": "HISTORICAL RECONSTRUCTION",
    "iceage": "ICE AGE VISUALIZATION",
    "audio": "SPATIAL AUDIO, SYNCHRONIZED",
}

# global arrival times (film seconds) for the spine and the loop -- the
# path's lit_frac between these is a straight time interpolation between
# each waypoint's cumulative-length fraction (see render_map.py's
# build_arrival_interp). PLACE "arrives" at 6.0 (the node appearing, not
# a traveled segment -- there's nowhere to travel from yet); ZONE arrives
# at 21.0, inside the zone section (18.0-31.0).
SPINE_ARRIVALS = [6.0, 10.0, 14.5, 21.0]
LOOP_ARRIVALS = [49.0, 52.5, 56.0, 59.5, 63.0]

VO_LINES = [
    # TIGHTENED from the original ("...built for real destinations like
    # Falls Park.") -- measured synthesis overran the 7.0s section by
    # 0.78s. Same claim, fewer words -- Falls Park is already established
    # visually (the section opens on it) and by v35's own narration.
    ("place", 1.8,
     "Open Range Interactive is a place-based experience, built for "
     "real destinations."),
    ("hwsw", 0.3,
     "Visitors borrow a pair of glasses -- the hardware -- and run a "
     "place-based experience on them -- the software -- then return "
     "the glasses when they're done."),
    ("zone", 0.3,
     "As a visitor enters an experience zone, the system recognizes "
     "where they are and anchors digital content to that real "
     "landscape."),
    ("examples", 0.3,
     "That layer can hold a historical reconstruction, shift the falls "
     "into an Ice Age visualization, or move spatial audio through the "
     "scene, synchronized between visitors."),
    ("loop", 0.3,
     "The operating loop is simple: borrow the hardware, experience the "
     "story, return the hardware, and update the software -- without "
     "filling the park with permanent installations."),
    ("close", 0.3,
     "Open Range Interactive: place-based stories, experienced where "
     "they belong."),
]
