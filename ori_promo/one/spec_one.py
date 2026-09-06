# ORI — "WHAT THIS PLACE WAS". v31 — FULL CREATIVE RESTART.
#
# OPERATOR: "Save the video that you currently have somewhere so I can
# retrieve it later if I want to. But you and ChatGPT need to completely
# restart. Completely burn down what you have. Completely restart with
# the whole thing in mind that this needs to look like an Apple promo
# video." The v30.2 cut is archived (commit 9ad5599, delivered to the
# operator directly) and is not this file's problem anymore.
#
# WHAT "BURN DOWN" MEANT IN PRACTICE. Every prior round from v18 through
# v30.2 was a PATCH on one structure: 17 beats in 65s, averaging 3.8s a
# cut, built around a menu-and-diagram HUD (a legend card with four
# colour-coded bullet points, a group-sync circle diagram). Every fix
# made that structure cleaner. None of them asked whether that structure
# was the right one for "look like an Apple promo video" -- which is not
# a grading note, it is a pacing and information-density note. Apple
# spots do not narrate every capability with its own on-screen menu; they
# pick the two or three that matter, say them in a sentence each, and
# spend the rest of the runtime holding a single beautiful image long
# enough to feel like something instead of scanning like a spec sheet.
#
# WHAT CHANGED, CONCRETELY:
#  - map/sync ARE GONE AS BEATS. The rental-pickup fact and the group-sync
#    fact are both still in the film -- folded into `open`'s and `lock`'s
#    VO as one clause each -- but neither owns a dedicated visual anymore,
#    and the legend-card / circle-diagram UI they carried (one/
#    map_overlay.py, one/sync_overlay.py) is retired with them. Nothing
#    the operator asked to have SAID is gone; what's gone is the widget
#    that said it.
#  - EVERY BEAT THAT CARRIES AN ERA (`dak`, `settle`, `ice`, `mam`) IS
#    ROUGHLY DOUBLED IN LENGTH. These are the emotional core of the film
#    and they were getting 3.8-5.0s each -- barely enough to register
#    before the dissolve. They now hold 7-8s each, which is the
#    difference between "a slide changed" and "something arrived."
#  - `hero` (the product itself) DOUBLES too, 2.5s -> 5.0s. If this
#    device is the entire premise of the film, the one shot that shows it
#    with nothing else on screen has earned more than a glance.
#  - VO IS SPARSER, NOT JUST SHORTER. Four beats now carry NO narration at
#    all (`sign`, `hero`, `now`, `end`) -- the location card, the product
#    shot, the "ONE PLACE / EVERY TIME" title and the wordmark all say
#    what they need to say without a voice under them. Silence over a
#    beautiful frame is not dead air in this genre, it is the point.
#
# WHAT DID NOT CHANGE: same real footage (no new shoot exists to draw
# on), same approved facts and claims (nothing here states a date, a
# measurement, a partnership, traction or a deployment that isn't real --
# same standing rule as every version before this one), same operator-
# approved lines reused verbatim where a line was already exactly right
# (`off`'s "No tour group. No phone in your face. You just look." did not
# need touching). The Dakota cultural-review gap is UNCHANGED -- still no
# advisor or tribal contact has reviewed the reconstruction, and that is
# still true regardless of how the beat around it is paced.
#
# FOOTAGE SAFETY FACTS, CARRIED FORWARD (measured across v18-v30, not
# re-guessed here -- render_one.py's own footage gate re-checks all of
# this at render time regardless, but these are the known edges):
#  - IMG_6799 (`prod`) is 12.37s long; in-point 7.0 for MORE than ~3.0s
#    visibly picks up hand-shake in the shot's last second. Left at 3.0s.
#  - IMG_6803 (`off`) is 7.10s long; in-point 2.5 for MORE than ~3.5-4.0s
#    runs into the handheld drift as the original recording stops.
#  - IMG_6806 (`on`/`lock`/`open`) is one continuous 59.5s take; the
#    temple-reach gesture itself sits at 8.6-9.0s on the clip's own
#    clock, so `on`'s in-point (8.4) must not move later than that.
#  - IMG_6797 (`reach`), IMG_6807 (`walk`), IMG_6796 (`sign`), IMG_6808
#    (`past`) and IMG_6804 (`mam`/`now`) are all 25-71s long with room to
#    spare at their existing in-points.
W, H, FPS = 1920, 1080, 30
TOTAL = 79.0

# beat, clip, in-point, start, dur, what the beat does
BEATS = [
 # ---- ACT 1: THE PROBLEM. Two beats. The location card (TITLES, below)
 # carries the "where" in text; VO stays silent on `sign` so it isn't
 # saying what's already on screen.
 ("sign", "6796", 29.0, 0.0, 5.0, "the story as it's told today: a man reading a plaque, held"),
 ("past", "6808", 22.0, 5.0, 4.0, "the park going by around it, nobody stopping"),
 # ---- ACT 2: THE PRODUCT. `prod` capped at 3.0s -- see the footage note
 # above, this is not a pacing choice, IMG_6799 runs out of clean frame.
 ("prod", "6799",  7.0, 9.0, 3.0, "the wearer, the glasses on him, the whole park in front"),
 # `hero`: the product itself, alone, held twice as long as it used to be.
 # ai/hero/build_hero_plate.py's default `dur` now matches this beat.
 ("hero", "HERO1", 0.0, 12.0, 5.0, "the product itself, nothing else on screen, no rush"),
 # ---- ONE CONTINUOUS TAKE, THREE BEATS, IN-POINTS DERIVED FROM EACH
 # OTHER'S END so there is no jump cut inside a single take.
 ("on",   "6806",  8.4, 17.0, 3.0, "he raises a hand to the temple — switching it on"),
 ("lock", "6806", 11.4, 20.0, 3.5, "recognises the falls, and (in VO) who he's with"),
 ("open", "6806", 14.9, 23.5, 4.0, "anchored to the real place, and (in VO) how you get a pair"),
 ("reach", "6797", 40.0, 27.5, 4.0, "he walks, and the past is where he arrives"),
 # ---- ACT 3: THE ERAS. The emotional core of the film, and the reason
 # this restart exists: these four beats used to get 3.8-5.0s each. They
 # now get 7-8. ai/dak/build_dak_plate.py and ai/settle/
 # build_settle_plate.py's default `dur` are updated to match.
 ("dak",  "DAK1",  0.0, 31.5, 8.0, "before the mill, the family answers where he has stopped"),
 ("settle", "SETTLE1", 0.0, 39.5, 7.0, "the settlement era, further up the same bank"),
 ("ice",  "ICE1",  0.0, 46.5, 7.0, "it runs further back and the whole valley freezes"),
 ("mam",  "6804", 26.0, 53.5, 7.0, "the payoff — the same shelf under ice, and a mammoth on it"),
 # `now`: no VO. The title card says "ONE PLACE / EVERY TIME"; a voice
 # saying the same words under it would be redundant, not emphatic.
 ("now",  "6804", 34.0, 60.5, 5.5, "back to NOW, the thaw, no marker, just the dissolve"),
 # ---- ACT 4: THE CLOSE.
 ("off",  "6803",  2.5, 66.0, 3.5, "glasses off the story, the real place, nothing drawn on it"),
 ("walk", "6807", 12.0, 69.5, 5.0, "the closing line over the park as it actually is"),
 ("end",   None,   0.0, 74.5, 4.5, "held from walk's last frame — which is PRESENT DAY"),
]

# Beats with a present-day person close enough to hold OUT of the ice
# grade. The wide valley has nobody near camera, and on that plate the
# depth threshold grabs the foreground rock; a mask built for one plate
# is not a mask for every plate.
WEARER_BEATS = {"mam", "now"}

# The first act is the world BEFORE the product -- drawing a HUD over it
# would claim the glasses are already on. The last act is the same in
# reverse: he has looked, the film is over, a HUD on the closing frames
# would claim the device is still running when the point is that you just
# look.
UI_OFF = {"sign", "past", "prod", "hero", "reach", "off", "walk"}

# beat: (title, subtitle, appear_t[, scale]) — the film's own voice, drawn
# bottom-left with a scrim, no reticle and no leader line.
TITLES = {
 "sign": ("FALLS PARK", "SIOUX FALLS, SOUTH DAKOTA", 0.6),
 "now":  ("ONE PLACE", "EVERY TIME", 2.2, 1.3),
}

# beat: (image, foot_xy, height_px, appear_t, build, subj_depth, match
#        [, out_t][, shadow][, contact])
# See spec_one.py's git history (v22-v29) for the full measurement record
# behind these numbers (560px scale, 0.34 shadow, 0.22 match, 0.72
# contact) -- unchanged by this restart, only the beat's ON-SCREEN TIME
# changed (5.0s -> 7.0s), not the figure itself.
FIGURES = {
 "mam": [("ai/era/mam41f.jpg",  (1330, 730), 560, 2.2, 1.0, 0.30, 0.22, None, 0.34, 0.72)],
}

LABELS = {
 "hero": ((150, 900), "THE HARDWARE", "VISUALISATION", 0.35, (0, 0)),
 "dak": ((150, 850), "BEFORE THE MILL", "VISUALISATION", 1.0, (0, 0)),
 "settle": ((150, 850), "THE SETTLEMENT", "VISUALISATION", 1.0, (0, 0)),
 "ice": ((520, 760),  "THE LAST ICE",    "VISUALISATION", 2.4, (40, -300)),
 # RECOGNITION -- names a real waterfall in an unmodified frame; the
 # device identifying where the wearer is, before the film shows it can
 # move him through time. No date, no history, no claim beyond a place
 # name and a river name, both visible in the frame.
 "lock": ((880, 560), "THE FALLS", "BIG SIOUX RIVER", 0.9, (250, -330), 0.80),
}

# beat -> (in_start, in_end, out_start, out_end); out may be None.
ICE = {
 "mam": (-1.0, 0.0, None, None),
 "now": (-1.0, 0.0, 0.8, 2.4),
}

# Beats whose plate is ALREADY an ice age and must not be graded into one
# again, but which still want falling snow so a generated still has
# weather in it.
GEN_ICE = {"ice"}

SCORE = {
 "start":  "sign",
 "arrive": "reach",
 "lift":   "dak",
 "hold":   "settle",
 "cold":   "ice",
 "warm":   "now",
}
def figures(beat):
    """FIGURES rows, normalised to 10 fields.

    (image, foot_xy, height_px, appear_t, build, subj_depth, match,
     out_t, shadow, contact)

    out_t is when the figure leaves; None means it stays to the end of the
    beat. shadow is the ground-shadow strength, default 0.62. contact is
    the density of the patch directly under the feet, and None means "tie
    it to shadow".
    """
    out = []
    for f in FIGURES.get(beat, []):
        f = tuple(f)
        if len(f) < 8:
            f = f + (None,)
        if len(f) < 9:
            f = f + (0.62,)
        if len(f) < 10:
            f = f + (None,)
        out.append(f)
    return out


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
