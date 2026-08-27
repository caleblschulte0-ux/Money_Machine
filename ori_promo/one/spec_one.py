# ORI — "WHAT THIS PLACE WAS". v4.
#
# OPERATOR, 2026-08-27, on v3: "the video was closer but not any where near
# personal grade cut some b roll in there I have plenty of it".
#
# WHAT V3 WAS. Forty-four seconds -- then thirty-eight -- of ONE plate.
# IMG_6804 from 6.0s to 41.0s, uncut, with eras swapping on it. Every era
# landed on the same rock in the same framing from the same standing
# position, so the film had exactly one idea about where it was and never
# showed the viewer the place it kept naming. Worse: in five versions this
# film has NEVER SHOWN THE FALLS. The waterfall the park is named after,
# the reason anyone would point a pair of glasses at that rock, was not in
# a single frame.
#
# WHAT V4 DOES. Twenty-six of the thirty-four raw clips had never been
# used. Four of them now open the film as a montage -- the falls, water on
# rock, the park wide with the mill ruin, and the walk in -- so by the time
# the device comes up the viewer knows the location, and the hero plate is
# an ARRIVAL instead of a cold start. A fifth cutaway (rock texture) hides
# the SETTLERS -> ICE era change, which is the one swap that has to travel
# furthest.
#
# THE CUT IS GATED, NOT GUESSED. Every in-point and duration below was run
# through shotqc first and the whole table came back 0 flagged. The falls
# plate is the reason durations are short: IMG_6682 fails DRIFT at 2.5s
# (18.8-34.4%) and PASSES at 1.6s (11.0%). The gate does not veto the shot,
# it sets how long the shot may be held -- which is also why the montage
# reads fast rather than lingering.
#
# THE DEVICE UI IS OFF UNDER THE MONTAGE. The viewfinder frame comes up on
# "open", with the first label. Running the corner cues over documentary
# B-roll would claim the phone footage was a device view; it isn't, and the
# film is stronger if the glasses switch on in front of you.
W, H, FPS = 1920, 1080, 30
TOTAL = 37.9

# beat, clip, in-point, start, dur, what the beat does
BEATS = [
 # --- the place, before any product claim is made ---
 ("bA",   "6682", 24.0,  0.0, 1.6, "THE FALLS. never once been in this film"),
 ("bB",   "6681",  8.0,  1.6, 1.2, "water on rock, tight"),
 ("bC",   "6699", 12.0,  2.8, 2.0, "the park wide, with the mill ruin"),
 # 6808@24 WAS HERE and it was a mowed lawn with a distant treeline and
 # two specks of people -- municipal, empty, and it stalled the montage
 # dead in the beat before the device comes up. I picked it off gate
 # numbers without looking at it, which is how a shot with nothing wrong
 # and nothing in it gets into a cut. 6806@48 is the wearer standing at the
 # falls from behind, same brown shirt as the hero plate: it introduces the
 # person before we take his point of view, and it rhymes with the plate
 # the rest of the film lives on.
 ("bD",   "6806", 48.0,  4.8, 1.8, "the wearer at the falls, from behind"),
 # --- the device comes up. hero plate, one continuous take from here ---
 ("open", "6804",  6.0,  6.6, 2.6, "the view. the system names the rock it is looking at"),
 ("e1",   "6804", 10.0,  9.2, 6.0, "BEFORE THE MILL: a Dakota family, the one full AR reveal"),
 ("e2",   "6804", 18.0, 15.2, 6.0, "THE SETTLERS: the era swaps on the cut, no reveal"),
 ("bE",   "6686", 16.0, 21.2, 1.2, "rock texture — the cutaway the ice change hides behind"),
 ("e3",   "6804", 26.0, 22.4, 6.0, "THE LAST ICE: the same view frozen, and a mammoth"),
 ("e4",   "6804", 34.0, 28.4, 6.0, "RETURN, then ALL THREE ERAS on the same rock at once"),
 ("end",   None,   0.0, 34.4, 3.5, "held from e4's last frame — which is PRESENT DAY"),
]

# Beats that get NO viewfinder frame: the establishing montage. bE keeps it
# because it is a cutaway inside the demo, not before it.
UI_OFF = {"bA", "bB", "bC", "bD"}

# beat: (title, subtitle, appear_t) — plain documentary title, bottom left,
# no leader line and no reticle. This is not the system recognising
# anything, so it must not be dressed as an AR label.
# It sits on bC, not on the opening frame: bA is 1.6s (the gate's ceiling
# for that plate) and a two-line title that appears and is cut away inside
# 1.35s is a flash, not a title. bC is the wide with the mill ruin -- the
# establishing frame -- and gives it 1.85s.
TITLES = {
 "bC": ("FALLS PARK", "SIOUX FALLS, SOUTH DAKOTA", 0.15),
}

# THE FRONTAL POSING IS A KNOWN, UNFIXED TELL — and the fix was TRIED and
# REJECTED, which is worth more to the next session than a TODO.
#
# r78, on both family groups: "nearly frontal catalogue-like posing",
# "doll-like facial style and symmetrical front-facing pose", "reads like
# generated costume art rather than a reconstruction occupying the shelf".
# That is accurate. Six people in two lines, all facing the lens.
#
# Two generation passes tried to replace them with three-quarter-behind
# groups doing something (_gen_v4figs.py, _gen_v4figs2.py):
#   pass 1  came back as five full landscape PAINTINGS -- mountains, pine
#           forest, a lake -- and the Dakota group in PINK BATHROBES. Cause
#           was in the prompt: given both a scene and "isolated on a plain
#           white background", this model builds the scene. Fixed by
#           deleting every environment word.
#   pass 2  came back correctly isolated on white (see ../_dak5.png) and is
#           still WORSE than what it would replace: three same-height adults
#           in identical plain beige robes, standing in a rigid line, backs
#           to camera. The crouching child and the pointing child were both
#           dropped. dak_s17 at least has real mixed ages, distinct
#           silhouettes and fringed hide garments -- and it is the frame the
#           operator picked out of the whole film.
#
# So the set below is UNCHANGED for the humans. Shipping a worse asset to
# satisfy a correct critique is not an improvement. Fixing this properly
# needs a generator that will hold a multi-figure pose brief, or hand-picked
# reference art, not another seed sweep of the same model.
# beat: (image, foot_xy, height_px, appear_t, build_seconds, subj_depth, match)
# Every height stays in the 300-390px band. The operator kept the beat that
# placed figures at 385 and rejected those at 450 and 520; same generator,
# same prompts, same compositor, size the only variable.
FIGURES = {
 # the one full reveal, and it is given room: 1.4s build
 "e1": [("ai/era/dak_s17.jpg",  (1150, 745), 385, 0.7, 1.4, 0.30, 0.55)],
 # from here the era is simply present at the cut -- 0.15s in, 0.45s build
 # match 0.30, not 0.55. light_match pulls the cutout's per-channel mean
 # toward the plate patch it lands in, and this group's patch is sunlit
 # quartzite -- about as bright as this footage gets. At 0.55 the black
 # hats went grey, the mother's dark skirt went to haze and the whole group
 # read as a ghost rather than a reconstruction (r78: "bright,
 # low-contrast edges ... make them look cut out"). Measured on a still at
 # 0.55 / 0.30 / 0.15: 0.30 keeps the garment tones and still sits in the
 # plate's colour. The Dakota group stays at 0.55 -- it is earth-toned and
 # has nothing to wash out.
 "e2": [("ai/era/fam3_s3.jpg",  (1180, 700), 360, 0.15, 0.45, 0.30, 0.30)],
 # mam_s17 -> mam41f. TWO reasons, both visible at delivery size on a grey
 # card (../_mam_ab.png). s17 mattes with a translucent grey ghost around
 # the entire body -- the original background surviving inside the alpha,
 # which is r78's "pale rim ... reads composited". And its frontal-ish
 # three-quarter view with the ears spread reads ELEPHANT: no shoulder
 # hump, no domed skull. s41 mattes clean and has the mammoth silhouette
 # (high hump, sloping back, heavy shag). It is MIRRORED (mam41f.jpg)
 # because s41 faces frame right, i.e. away from the wearer, and an animal
 # walking out of frame away from the person looking at it is the wrong
 # picture.
 "e3": [("ai/era/mam41f.jpg",    (1330, 690), 320, 0.30, 0.60, 0.30, 0.45)],
 # THE CLOSER. Spread across the ledge so the two family groups read as
 # two groups and not one crowd, and sized a touch down from their own
 # beats so three of them fit without the frame feeling stacked.
 "e4": [("ai/era/dak_s17.jpg",  (955, 775), 355, 2.0, 1.0, 0.30, 0.55),
        ("ai/era/fam3_s3.jpg",  (1285, 728), 335, 2.3, 1.0, 0.30, 0.30),
        ("ai/era/mam41f.jpg",    (1615, 700), 290, 2.6, 1.0, 0.30, 0.45)],
}

# beat: (anchor_xy, title, subtitle, appear_t, offset_xy)
# The leader anchors at each group's LEFT EDGE. Anchored centre it dropped
# straight down through the middle figure's face.
LABELS = {
 "open": ((1240, 800), "SIOUX QUARTZITE", "SURFACE",        1.4, (-40, -300)),
 "e1":   ((1032, 752), "BEFORE THE MILL", "VISUALISATION",  2.0, (-40, -410)),
 "e2":   ((1072, 707), "THE SETTLERS",    "VISUALISATION",  1.0, (-40, -390)),
 "e3":   ((1222, 700), "THE LAST ICE",    "VISUALISATION",  1.4, (-40, -380)),
 # anchored at 838, not 955: at the closer's smaller placement the Dakota
 # group spans roughly 830-1080, so 955 was its CENTRE and the leader went
 # straight down through it again. 838 puts the line just off its left
 # shoulder. "Left edge" has to be measured per placement, not reused.
 "e4":   ((838, 788),  "ONE PLACE",       "EVERY TIME",     3.6, (-40, -430)),
}

# The ice ramps IN over e3 and back OUT over e4, so the return to now is an
# event you watch rather than something that happened on a cut.
# beat -> (direction, ramp_start, ramp_end) in seconds into that beat
ICE = {
 "e3": ("in",  0.1, 1.4),
 "e4": ("out", 0.0, 1.6),
}

# The score reads its shape from HERE, by role, so renaming or re-ordering
# beats cannot silently leave the music playing the old edit. v3's score
# hardcoded "b1".."b4"; under v4's names that would have raised, which is
# the correct failure -- but only because these are looked up by name.
SCORE = {
 "start":  "bA",     # montage: near silence, the place only
 "arrive": "open",   # the device comes up
 "lift":   "e1",     # the one full reveal
 "hold":   "e2",
 "cold":   "e3",     # low voices leave
 "warm":   "e4",     # they come back with the colour
}


def timeline():
    t = 0.0
    for b in BEATS:
        assert abs(b[3] - t) < 1e-6, f"{b[0]} starts at {b[3]}, expected {t}"
        t += b[4]
    assert abs(t - TOTAL) < 1e-6, f"beats total {t}, expected {TOTAL}"
    return t


_names = [b[0] for b in BEATS]
for _d, _lbl in ((FIGURES, "FIGURES"), (LABELS, "LABELS"), (ICE, "ICE"),
                 (TITLES, "TITLES")):
    for _k in _d:
        assert _k in _names, f"{_lbl} references unknown beat {_k!r}"
for _k in SCORE.values():
    assert _k in _names, f"SCORE references unknown beat {_k!r}"
