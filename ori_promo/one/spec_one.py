# ORI — "WHAT THIS PLACE WAS". v8.
#
# OPERATOR on v7:
#   "those first settlers, like, the... their sizing is terrible. Their
#    anchoring is terrible. The falls when it hits the ice age looks like
#    complete shit. ... the other two AI pictures I don't think were
#    anchored or put in that horribly ... add a little narration and
#    completely cut the sound out of the videos because there's a lot of
#    me talking in the background ... it's still not quite giving me the
#    feeling I wanted to."
#
# THE SETTLERS BEAT IS GONE. Not moved, not resized -- cut. r78, r80, r82
# and now the operator have all named that asset as the weakest thing on
# screen; it is the only element every reviewer independently failed. Its
# figures wear floor-length dresses, so there are no feet to land on the
# ground, and its own internal proportions are wrong (the two children are
# nearly the mother's height). No placement fixes either. I cannot
# regenerate it -- the image endpoint now serves one model and ignores the
# one that made these assets (see ai/eras.py) -- so the honest move is to
# stop showing it. It returns when there is an asset that earns its place.
#
# THE FALLS ICE BEAT IS GONE TOO, and for a reason worth writing down: the
# frozen-falls still looked spectacular to ME in a single test frame, and
# it fails in motion for two things a still does not show. Its plate holds
# TWO sharp present-day people in bright modern clothes filling the right
# third -- on the hero plate the wearer is one out-of-focus head, which
# reads as intentional, but two of them read as a mistake. And moving
# water cannot be frozen by killing its local contrast: it reads as
# over-exposed water, not ice. The ice now runs on plates that are mostly
# rock: the wide valley, which has no one near camera at all, and the
# hero shelf, which is the version nobody objected to.
#
# WHAT CARRIES OVER FROM v7, because it worked: five slow beats, every cut
# a half-second dissolve. Measured on the v7 master, the worst single-frame
# change fell from 82.3% of the picture to 19.0%.
#
# SOUND: the location audio is GONE, all of it, on the operator's
# instruction -- he is audible talking behind several plates and the
# footage was never shot for sound. Score, confirmation ticks and
# narration only. See one/vo_one.py.
W, H, FPS = 1920, 1080, 30
TOTAL = 33.5

# beat, clip, in-point, start, dur, what the beat does
BEATS = [
 ("open", "6806",  6.0,  0.0, 5.0, "the falls as they are. the system comes up"),
 ("dak",  "6804", 10.0,  5.0, 7.0, "BEFORE THE MILL — a Dakota family on the quartzite"),
 ("ice",  "6791", 14.0, 12.0, 6.5, "THE LAST ICE — the whole valley frozen, nobody in it"),
 ("mam",  "6804", 26.0, 18.5, 6.5, "the same shelf under the ice, and a mammoth on it"),
 ("now",  "6804", 34.0, 25.0, 5.0, "the thaw, and the closing line"),
 ("end",   None,   0.0, 30.0, 3.5, "held from now's last frame — which is PRESENT DAY"),
]

# Beats with a present-day person close enough to hold OUT of the ice
# grade. The wide valley has nobody near camera, and on that plate the
# depth threshold grabs 22% of the frame -- the foreground rock -- and
# would have left a raw summer-coloured slab across the bottom of an ice
# age. A mask built for one plate is not a mask for every plate.
WEARER_BEATS = {"mam", "now"}

# v6 ran the opening montage without the viewfinder because it was
# documentary B-roll claiming nothing. v7 has no montage: every beat is
# the device looking at something, so the UI belongs on all of them.
UI_OFF = set()

# beat: (title, subtitle, appear_t[, scale]) — the film's own voice, drawn
# bottom-left with a scrim, no reticle and no leader line.
TITLES = {
 "open": ("FALLS PARK", "SIOUX FALLS, SOUTH DAKOTA", 0.6),
 "now":  ("ONE PLACE", "EVERY TIME", 2.2, 1.3),
}

# beat: (image, foot_xy, height_px, appear_t, build, subj_depth, match[, out_t])
# Heights stay in the 300-390 band on the two figure plates. The mammoth
# is smaller because it stands on the FAR ledge across the water, and at
# that distance an animal reads by silhouette.
FIGURES = {
 "dak": [("ai/era/dak_s17.jpg", (1150, 745), 385, 1.2, 1.4, 0.30, 0.55)],
 "mam": [("ai/era/mam41f.jpg",  (1330, 690), 320, 2.2, 1.0, 0.30, 0.45)],
}

LABELS = {
 "dak": ((1032, 752), "BEFORE THE MILL", "VISUALISATION", 2.9, (-40, -410)),
 "ice": ((520, 760),  "THE LAST ICE",    "VISUALISATION", 2.4, (40, -300)),
}

# beat -> (in_start, in_end, out_start, out_end); out may be None.
# The ice arrives on `ice`, is simply PRESENT on `mam` (it did not thaw
# between two shots of the same era), and leaves on `now` so the film
# returns to the present on screen rather than on a cut.
ICE = {
 "ice": (0.3, 2.3, None, None),
 "mam": (-1.0, 0.0, None, None),
 "now": (-1.0, 0.0, 0.2, 1.8),
}

SCORE = {
 "start":  "open",
 "arrive": "dak",
 "lift":   "dak",
 "hold":   "dak",
 "cold":   "ice",
 "warm":   "now",
}
def figures(beat):
    """FIGURES rows, normalised to 8 fields.

    (image, foot_xy, height_px, appear_t, build, subj_depth, match, out_t)
    out_t is when the figure leaves; None means it stays to the end of the
    beat. Optional eighth field so every 7-field row keeps working.
    """
    return [f if len(f) == 8 else f + (None,) for f in FIGURES.get(beat, [])]


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
for _b, _env in ICE.items():
    assert len(_env) == 4, f"ICE[{_b!r}] must be (in0, in1, out0, out1)"
