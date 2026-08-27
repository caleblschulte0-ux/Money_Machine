# ORI — "WHAT THIS PLACE WAS". v3.
#
# OPERATOR, 2026-08-27, on v2: "It's getting better. Still needs a lot of
# work. ... you're heading in the right direction more than you ever have
# been." No new requirements, so this pass is my own audit of v2, watched
# at 2s intervals end to end.
#
# WHAT THE AUDIT FOUND, and it was mostly DEAD AIR. Roughly 12 of v2's 44
# seconds had nothing on screen at all:
#   4s   after the opener, the wearer looking at bare rock
#   ~1.5s at EVERY era change, because appear_t was 1.5 and the outgoing
#         era had already gone -- an empty beat between each pair
#   5s   the "return" beat, which was five seconds of nothing happening
# For a cold send to a VC that is fatal. v3 removes all of it.
#
# THE MARKER OPENER IS GONE. It was a different plate (6796), which broke
# the single-take idea two seconds in, and the image itself was weak -- a
# man in red shorts beside a fence and a lamp post. Its JOB was real: the
# system recognising a real named thing. That job now happens on the hero
# plate instead, labelling the quartzite the camera is actually pointed at,
# so the proof survives and the take stays unbroken.
#
# ERA SWAPS ARE NEAR-INSTANT NOW. Only the first era gets the full AR
# reveal -- that is the "the system places something" moment and it should
# be seen. After that, each era is simply THERE at the cut, because the
# thing being demonstrated is scrubbing through time, and a viewer who has
# already watched one reveal does not need three more.
W, H, FPS = 1920, 1080, 30
TOTAL = 38.5

# beat, clip, in-point, start, dur, what the beat does
# in-points are CONSECUTIVE across one 50.4s take: 6.0 -> 39.0.
BEATS = [
 ("open", "6804",  6.0,  0.0, 4.0, "the view. the system comes up and names the rock it is looking at"),
 ("b1",   "6804", 10.0,  4.0, 8.0, "BEFORE THE MILL: a Dakota family, the one full AR reveal"),
 ("b2",   "6804", 18.0, 12.0, 8.0, "THE SETTLERS: the era swaps on the cut, no reveal"),
 ("b3",   "6804", 26.0, 20.0, 9.0, "THE LAST ICE: the same view frozen, and a mammoth"),
 # b4 WAS four seconds of a man looking at bare rock once the thaw
 # finished -- the tail of the film had nothing in it. It now carries the
 # closing image: the ice lifts, and then all three eras stand on the
 # same ledge at once. That is the thesis of the product in one frame,
 # and it is the only place in the film where the eras are seen together.
 ("b4",   "6804", 35.0, 29.0, 6.0, "RETURN, then ALL THREE ERAS on the same rock at once"),
 ("end",   None,   0.0, 35.0, 3.5, "held from b4's last frame — which is PRESENT DAY"),
]

# beat: (image, foot_xy, height_px, appear_t, build_seconds, subj_depth, match)
# Every height stays in the 300-390px band. The operator kept the beat that
# placed figures at 385 and rejected those at 450 and 520; same generator,
# same prompts, same compositor, size the only variable.
FIGURES = {
 # the one full reveal, and it is given room: 1.4s build
 "b1": [("ai/era/dak_s17.jpg",  (1150, 745), 385, 0.7, 1.4, 0.30, 0.55)],
 # from here the era is simply present at the cut -- 0.15s in, 0.45s build
 "b2": [("ai/era/fam3_s3.jpg",  (1180, 700), 360, 0.15, 0.45, 0.30, 0.55)],
 "b3": [("ai/era/mam_s17.jpg",  (1330, 690), 300, 0.30, 0.60, 0.30, 0.45)],
 # THE CLOSER. Spread across the ledge so the two family groups read as
 # two groups and not one crowd, and sized a touch down from their own
 # beats so three of them fit without the frame feeling stacked.
 "b4": [("ai/era/dak_s17.jpg",  (955, 775), 355, 2.0, 1.0, 0.30, 0.55),
        ("ai/era/fam3_s3.jpg",  (1285, 728), 335, 2.3, 1.0, 0.30, 0.55),
        ("ai/era/mam_s17.jpg",  (1615, 700), 275, 2.6, 1.0, 0.30, 0.45)],
}

# beat: (anchor_xy, title, subtitle, appear_t, offset_xy)
# The leader anchors at each group's LEFT EDGE. Anchored centre it dropped
# straight down through the middle figure's face.
LABELS = {
 "open": ((1240, 800), "SIOUX QUARTZITE", "SURFACE",        1.4, (-40, -300)),
 "b1":   ((1032, 752), "BEFORE THE MILL", "VISUALISATION",  2.0, (-40, -410)),
 "b2":   ((1072, 707), "THE SETTLERS",    "VISUALISATION",  1.0, (-40, -390)),
 "b3":   ((1222, 700), "THE LAST ICE",    "VISUALISATION",  1.4, (-40, -380)),
 # anchored at 838, not 955: at the closer's smaller placement the Dakota
 # group spans roughly 830-1080, so 955 was its CENTRE and the leader went
 # straight down through it again. 838 puts the line just off its left
 # shoulder. "Left edge" has to be measured per placement, not reused.
 "b4":   ((838, 788),  "ONE PLACE",       "EVERY TIME",     3.6, (-40, -430)),
}

# The ice ramps IN over b3 and back OUT over b4.
# b4 used to be four seconds of a man looking at bare rock -- the "return
# to now" happened on a cut, so there was nothing to see and nothing to
# return FROM. Thawing it on screen makes the return the event: the snow
# goes, the colour comes back, and the beat has content instead of being
# a pause before the end card.
# beat -> (direction, ramp_start, ramp_end) in seconds into that beat
ICE = {
 "b3": ("in",  0.1, 1.4),
 "b4": ("out", 0.0, 1.6),
}


def timeline():
    t = 0.0
    for b in BEATS:
        assert abs(b[3] - t) < 1e-6, f"{b[0]} starts at {b[3]}, expected {t}"
        t += b[4]
    assert abs(t - TOTAL) < 1e-6, f"beats total {t}, expected {TOTAL}"
    return t
