# ORI — "WHAT THIS PLACE WAS". v2, rebuilt around the one shot that worked.
#
# OPERATOR RULING, 2026-08-27, on v1:
#   "Ok your getting closer now but I only liked one scsense out of the
#    whole thing everything else was bad ai or poorly sized or had
#    somthing else wrong with it"
#
# He screenshotted b3: the Dakota family on the rock shelf, seen over the
# wearer's shoulder. So that beat is not one good beat among six, it is
# THE RECIPE, and this version applies it to everything:
#
#   ONE PLATE.        IMG_6804 is 50.4s long and holds to drift 1.4% over
#                     38 of them. The whole spine is cut from it, in
#                     CONSECUTIVE segments, so the joins are invisible and
#                     the film plays as a single unbroken take in which
#                     time changes around a man who does not move.
#   ONE VIEWPOINT.    Over the wearer's shoulder, every era. That framing
#                     is what makes it read as something he is SEEING
#                     rather than a composite someone assembled.
#   ONE SCALE BAND.   300-390px. This matters more than it sounds: at
#                     450px+ the generator's faces and hands start showing
#                     their seams, which is most of what "bad ai" meant.
#                     Small is not a compromise here, it is the fix.
#   ONE LEDGE.        Every figure stands on the same flat shelf, so the
#                     eye learns where to look and the era is the only
#                     thing that changes.
#
# WHAT WAS CUT FROM v1 AND WHY
#   the mill reconstruction  a generic stone building, floating, and the
#                            light match pulled it green. It was the worst
#                            beat and its job -- naming the place -- is
#                            done better by the real marker in `open`.
#   the wide 6791 plates     they pan 16% and carried figures off frame
#   the seated settler group a seated man whose lower body is one
#                            shapeless mass. Replaced by fam3_s3: standing,
#                            full length, feet down, matching dak's build.
W, H, FPS = 1920, 1080, 30
TOTAL = 44.0

# beat, clip, in-point, start, dur, what the beat does
BEATS = [
 ("open", "6796", 48.0,  0.0, 6.0, "RECOGNISE: the Queen Bee Mill marker, a real sign the camera saw"),
 ("b1",   "6804",  8.0,  6.0, 4.0, "the view. the system is up and has placed nothing"),
 ("b2",   "6804", 12.0, 10.0, 8.0, "BEFORE THE MILL: a Dakota family on the shelf"),
 ("b3",   "6804", 20.0, 18.0, 8.0, "THE SETTLERS: standing on the same rock, a lifetime later"),
 ("b4",   "6804", 28.0, 26.0, 9.0, "THE LAST ICE: the same view frozen, and a mammoth on the shelf"),
 ("b5",   "6804", 37.0, 35.0, 5.0, "RETURN: the ice lifts and it is now again"),
 ("end",   None,   0.0, 40.0, 4.0, "held from b5's last frame"),
]

# beat: (image, foot_xy, height_px, appear_t, build_seconds, subj_depth, match)
# Every foot point is on the SAME shelf and every height is inside the
# 300-390 band. Chosen by placing and looking (era/_spine_test.png).
FIGURES = {
 "b2": [("ai/era/dak_s17.jpg",  (1150, 745), 385, 1.5, 1.8, 0.30, 0.55)],
 "b3": [("ai/era/fam3_s3.jpg",  (1180, 700), 360, 1.5, 1.8, 0.30, 0.55)],
 "b4": [("ai/era/mam_s17.jpg",  (1330, 690), 300, 2.4, 2.2, 0.30, 0.45)],
}

# beat: (anchor_xy, title, subtitle, appear_t, offset_xy)
# Labels sit UPPER RIGHT, over sky and treeline. The wearer's head fills
# the left third of every frame in this plate and a label there fights him.
LABELS = {
 "open": ((1000, 300), "QUEEN BEE MILL",  "ON THIS SITE",   1.8, (-560, 210)),
 # The leader anchors at the group's LEFT EDGE, not at its feet. Anchored
 # centre, the line dropped straight down THROUGH the middle figure in
 # all three beats -- a yellow rule through a face is the sort of thing
 # that reads as unfinished no matter how good the composite is. Offset
 # ~-40 so the line falls just outside the group and runs nearly vertical.
 "b2":   ((1032, 752), "BEFORE THE MILL", "VISUALISATION",  3.2, (-40, -410)),
 "b3":   ((1072, 707), "THE SETTLERS",    "VISUALISATION",  3.2, (-40, -390)),
 "b4":   ((1222, 700), "THE LAST ICE",    "VISUALISATION",  4.2, (-40, -380)),
}

# The ice grade ramps in over b4 and is never applied anywhere else.
ICE = {"beat": "b4", "in": (0.3, 2.5)}


def timeline():
    t = 0.0
    for b in BEATS:
        assert abs(b[3] - t) < 1e-6, f"{b[0]} starts at {b[3]}, expected {t}"
        t += b[4]
    assert abs(t - TOTAL) < 1e-6, f"beats total {t}, expected {TOTAL}"
    return t
