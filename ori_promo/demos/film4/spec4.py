# DEMO 4 -- "DEEP TIME". Lead capability: THE GLASSES READ THE PLACE IN THREE
# DIMENSIONS AND BY MATERIAL, AND CAN SHOW WHAT IS UNDER IT.
#
# Deliberately the furthest thing from Demo 1. Demo 1 recognises a NAMED THING
# and labels it. This one does not name anything: it measures. Materials by
# class, then a cutaway into ground nobody can see, then both at once. Two
# readings with genuinely different visual behaviour, and a density beat that
# runs them together. (It was three until r72 cut the terrain sweep -- see
# BEATS. "Three readings" is the line most likely to get copied forward into
# a deck after it stopped being true, so it is corrected at the source.)
#
# Every plate is gated by shotqc with zero flags -- no TAIL, no DRIFT, no JOLT.
#
# PLATE OVERLAP WITH DEMO 1, STATED PLAINLY. Only twelve of the thirty-four
# source clips are landscape, long enough to cut from, and clean under the
# gate; nine are rotated portrait and would have to be upscaled 1.78x to fill
# a 16:9 frame, which native_check refuses. So the two films draw from the
# same small pool. The ROLES, IN-POINTS, DURATIONS and every overlay are
# different, and the opener is a plate Demo 1 never uses -- but a viewer who
# watches both back to back will recognise the park, and should.
W, H, FPS = 1920, 1080, 30
TOTAL = 29.0

# beat, clip, in-point, start, dur, what the beat does
BEATS = [
 # r69 REALLOCATION. ChatGPT: "I agree it is the weakest beat... the contour
 # evidence is faint enough that the label does more work than the
 # visualization. After two strengthening attempts, another small opacity
 # pass is unlikely to change the basic read. Cut the terrain beat to roughly
 # 4-5 seconds and give the recovered 2-3 seconds to the subsurface
 # aperture... One unmistakable depth event is better than several soft
 # contour lines."
 # Terrain 7.5 -> 4.5, subsurface 8.0 -> 11.0. Both re-gated at the new
 # durations before the change was made: 6791@4.5 over 4.5s and 6794@10.5
 # over 11.0s both PASS.
 # r72: THE TERRAIN BEAT IS CUT. It had already been shortened twice --
 # 7.5s -> 4.5s at r69 -- and after two strengthening passes the contour
 # sweep was still faint enough that the label did more work than the
 # visualisation. Two independent cold reads (my own r70 note and
 # ChatGPT's r71 review) landed on the same verdict from the same
 # evidence, so it goes rather than getting a third opacity pass.
 # The film keeps three distinct behaviours -- materials, subsurface, and
 # the two-at-once density beat -- which is what actually differentiates
 # it from Demo 1. 33.5s -> 29.0s. The audio bed is generated from TOTAL
 # so it re-times itself; nothing else in the film is duration-coupled.
 ("open", "6798",  6.5,  0.0, 3.5, "the walkway. system comes up, nothing claimed yet"),
 ("b2",   "6805",  4.5,  3.5, 7.0, "MATERIALS: sky / vegetation / stone, outlined and named"),
 ("b3",   "6794", 10.5, 10.5,11.0, "SUBSURFACE: the hero. the ground opens and stays open"),
 ("b4",   "6796",  8.5, 21.5, 5.0, "TWO systems at once, not three -- r69 called three cluttered"),
 ("end",   None,   0.0, 26.5, 2.5, "held from b4's last frame"),
]

# Anchors for the tracked capability labels. Placed by marking them on the
# plate and looking (out4/anchor4.jpg), the same way Demo 1's were -- the
# first pass at that put labels in the sky above their objects, and the first
# pass at THIS put a label so far left that "BELOW THE SURFACE" cropped to the
# word "SURFACE".
# beat: (anchor_xy, title, subtitle, appear_t, label_offset_xy)
LABELS = {
 "b2": ((800, 360),  "MATERIAL CLASSES",  "SKY / PLANT / STONE",  1.2, (250, -180)),
 "b3": ((1250, 620), "BELOW THE SURFACE", "VISUALISATION",        1.6, (-560, -240)),
 "b4": ((1300, 700), "ONE PASS",          "RANGE + CLASS + CORE", 1.0, (-620, -250)),
}

# Where the ground opens. The anchor is tracked; the layer angle comes from the
# depth map's gradient there, so the bands lie along the real ground plane
# instead of across the screen.
APERTURE = {
 # b4's aperture was REMOVED with the r69 retime. The density beat now runs
 # two systems, not three. This table and render4.SCHED must agree: compose()
 # reads the anchor from here and the schedule from there, so leaving a b4
 # entry with SCHED["b4"]["ap"] set to None raises on the unpack.
 "b3": ((560, 930), 250, 1.6),      # (anchor, radius px, open at t)
}


def timeline():
    t = 0.0
    for b in BEATS:
        assert abs(b[3] - t) < 1e-6, f"{b[0]} starts at {b[3]}, expected {t}"
        t += b[4]
    assert abs(t - TOTAL) < 1e-6, f"beats total {t}, expected {TOTAL}"
    return t
