# ORI — "WHAT THIS PLACE WAS" -> retitled in practice, v32. NEW CONCEPT.
#
# OPERATOR, after seeing v31: "I said burn the old video. Like, obviously,
# don't burn it. Like, put it somewhere, but, like, completely start from
# scratch. That was not scratched. I wanna see nothing similar from the
# last video." v31 kept the exact same skeleton under new pacing -- same
# eras (Dakota family -> settlement -> ice age -> mammoth), same beat
# order, same "then vs now" reveal, same tagline. Retiming that skeleton
# was not a restart. This is.
#
# THE ACTUAL NEW CONCEPT: "One Continuous Experience." No historical eras,
# anywhere, in any form. No generated era plates (dak/settle/ice/mam are
# GONE, not retimed -- ai/dak, ai/settle, ai/ice's plates are unused by
# this spec). The hook is no longer "the glasses show you the past"; it is
# "the glasses recognise the present, continuously, without a chapter
# break for every capability." Concretely: the wearer puts the glasses on
# and THE SAME UNBROKEN SHOT (IMG_6806, one real continuous take) carries
# three things happening on top of it -- switching on, recognising the
# falls, anchoring to the place -- with no cut between them. That is the
# literal, technical meaning of "one continuous experience" here: there
# are three beat NAMES for editing/timing purposes below, but the footage
# under `on`/`lock`/`anchor` is one uninterrupted 9-second real take, in-
# points chosen to run back to back with zero overlap and zero gap.
#
# WHAT ELSE IS GONE, ON PURPOSE, so nothing here reads as v31 re-skinned:
#  - No generated era plates, no per-era LABELS, no ICE grade, no snowfall,
#    no wearer/mammoth compositing. FIGURES, ICE and GEN_ICE below are all
#    empty. render_one.py's era-compositing code is already fully data-
#    driven off those dicts, so it goes inert on its own -- nothing in
#    render_one.py needed touching for this.
#  - No mid-film title card ("ONE PLACE / EVERY TIME" is GONE). The only
#    text card in the whole film is the location card at the open and the
#    wordmark at the close. Zero chapter cards in between.
#  - No map/sync legend-card or circle-diagram (already retired in v31;
#    still retired here).
#  - The score's entire dramatic shape changes too (score_one.py) -- v31's
#    score literally simulated an ice age (bass drops out under `ice`,
#    returns under `now`) because the FILM did. A film with no ice age has
#    no business keeping a score that mimics one; it would be the one
#    piece of v31's DNA nobody would have caught. New score is a single
#    rise-and-release arc timed to the glasses turning on, not a four-act
#    historical journey.
#  - Runtime drops from 79.0s to 35.0s. Not a pacing accident -- cutting
#    four 7-8s era beats and not replacing them with anything of
#    equivalent length IS the concept. A tight, confident, done-in-35-
#    seconds spot is closer to an actual Apple product film (most run
#    30-45s) than anything this project has cut before.
#
# WHAT DID NOT CHANGE, and should not have: same real footage (no reshoot
# exists), same approved facts (software not hardware, recognition,
# anchoring, rental-not-owned, no phone-in-your-face) restated in new
# sentences where the old sentence assumed the eras existed ("He walks.
# The place answers where he stops." assumed a historical reveal at the
# end of the walk and had to be rewritten; "No tour group..." didn't
# assume anything era-related and is reused verbatim). No date, no
# measurement, no partnership, no traction, no deployment claim, no
# invented CTA -- same standing rule as every version before this one.
#
# THE DAKOTA CULTURAL-REVIEW GAP IS NO LONGER THIS VIDEO'S PROBLEM. That
# content does not appear here at all -- not resolved, not sidestepped,
# simply not present. The archived v30.2 cut (commit 9ad5599, delivered
# to the operator directly) still contains it if that thread is ever
# picked back up as its own project; it is not silently dropped, it is
# just not part of what this file describes.
#
# FOOTAGE SAFETY FACTS, CARRIED FORWARD UNCHANGED (measured across v18-
# v31; render_one.py's footage gate re-checks all of this at render time
# regardless):
#  - IMG_6799 (`prod`) is 12.37s long; in-point 7.0 for MORE than ~3.0s
#    visibly picks up hand-shake in the shot's last second. Left at 3.0s.
#  - IMG_6803 (`off`) is 7.10s long; in-point 2.5 for MORE than ~3.5-4.0s
#    runs into the handheld drift as the original recording stops.
#  - IMG_6806 (`on`/`lock`/`anchor`) is one continuous 59.5s take; the
#    temple-reach gesture itself sits at 8.6-9.0s on the clip's own clock,
#    so `on`'s in-point (8.4) must not move later than that. `lock` and
#    `anchor` now pick up exactly where the beat before them left off on
#    THIS SAME CLIP'S CLOCK (10.9 = 8.4+2.5, 13.9 = 10.9+3.0) so the take
#    never repeats or skips a frame across the three beat names.
#  - IMG_6797 (`reach`), IMG_6807 (`walk`), IMG_6796 (`sign`) and IMG_6808
#    (`past`) all have room to spare at their existing in-points.
W, H, FPS = 1920, 1080, 30
TOTAL = 41.1

# beat, clip, in-point, start, dur, what the beat does
BEATS = [
 # ---- COLD OPEN. The location card carries the "where" in text; VO stays
 # silent on `sign` so it isn't saying what's already on screen.
 ("sign", "6796", 29.0, 0.0, 3.5, "the story as it's told today: a man reading a plaque, held briefly"),
 ("past", "6808", 22.0, 3.5, 2.5, "the park going by around it, nobody stopping"),
 # `prod` capped at 3.0s -- see the footage note above, IMG_6799 runs out
 # of clean frame past that, not a pacing choice.
 ("prod", "6799",  7.0, 6.0, 3.0, "the wearer, the glasses on him, the whole park in front"),
 # `hero`: a brief, unlabelled-title glance at the product alone. EXTENDED
 # 3.0 -> 4.0 after the first render (below): `prod`'s VO genuinely runs
 # ~4.6s, longer than `prod`'s own footage-capped 3.0s beat, and it has to
 # land somewhere -- 3.0s of `hero` left only ~0.2s of true silence after
 # the tail absorbed, which is not "a glance," it's the beat playing
 # catch-up. 4.0s gives it real quiet at the end without pretending to be
 # v31's 5.0s chapter again.
 ("hero", "HERO1", 0.0, 9.0, 4.0, "the product itself, nothing else on screen, a glance not a chapter"),
 # ---- ONE CONTINUOUS TAKE, THREE BEAT NAMES, ZERO CUTS. In-points run
 # back to back on IMG_6806's own clock (8.4 -> 10.9 -> 14.7): this is
 # literally one unbroken take with three different things drawn over it
 # in sequence, which is the whole "one continuous experience" idea made
 # technical rather than just a marketing phrase. `lock` and `anchor` are
 # EXTENDED from the first pass (3.0->3.8, 3.5->5.0): both carry a full
 # sentence of real capability information (recognition; anchoring + the
 # rental model) and the first render's shorter durations ran the VO
 # 1.2-2.2s past their own beat. Since this is one continuous real shot
 # with 59.5s of total runway, giving the two capability statements more
 # of it costs nothing structurally -- it does not add a cut, a new beat,
 # or any of the DNA this restart is throwing out.
 ("on",     "6806",  8.4, 13.0, 2.5, "he raises a hand to the temple — switching it on"),
 ("lock",   "6806", 10.9, 15.5, 3.8, "recognises the falls, and (in VO) who he's with"),
 ("anchor", "6806", 14.7, 19.3, 5.0, "anchored to the real place, and (in VO) how you get a pair"),
 ("reach",  "6797", 40.0, 24.3, 4.0, "he keeps walking; the capability keeps up with him"),
 # ---- THE CLOSE. No mid-film title card exists in this cut at all.
 # `off` EXTENDED 3.0 -> 3.8 (still inside the ~3.5-4.0s footage-safety cap
 # noted above) to give its own well-liked, unedited line more room.
 ("off",  "6803",  2.5, 28.3, 3.8, "glasses off, the real place, nothing drawn on it"),
 # `walk` EXTENDED 4.0 -> 5.0 -- IMG_6807 has plenty of runway at this
 # in-point (24.865s total, in 12.0), and the closing line was running
 # 1.4s into the silent end card on the first pass, cutting the wordmark's
 # quiet hold nearly in half.
 ("walk", "6807", 12.0, 32.1, 5.0, "the closing line over the park as it actually is"),
 ("end",   None,   0.0, 37.1, 4.0, "held from walk's last frame — which is PRESENT DAY"),
]

# No beat needs the ice-age wearer mask -- there is no ice grade in this
# cut at all. Kept as an empty set (not deleted) because render_one.py
# still imports the name; it simply never matches.
WEARER_BEATS = set()

# The first act is the world BEFORE the product; the last act is after --
# a HUD over either would claim the glasses are on when they are not. The
# continuous on/lock/anchor take is deliberately EXCLUDED from this set:
# that is where the UI lives.
UI_OFF = {"sign", "past", "prod", "hero", "reach", "off", "walk"}

# beat: (title, subtitle, appear_t[, scale]) — the film's own voice, drawn
# bottom-left with a scrim, no reticle and no leader line. Only ONE card
# in the whole film now; there is no mid-film title.
TITLES = {
 "sign": ("FALLS PARK", "SIOUX FALLS, SOUTH DAKOTA", 0.6),
}

# No composited figures anywhere in this cut -- no mammoth, no era
# figures, nothing standing on the footage that isn't really there. Empty,
# not deleted, for the same reason WEARER_BEATS is empty above.
FIGURES = {}

LABELS = {
 # The one generated plate left in the film -- still gets the standing
 # VISUALISATION disclosure, same as every generated image in this
 # project's history. (An earlier draft of this file tried a blank title
 # here to strip it of "chapter" weight; recon_block() still reserves a
 # full title-line of vertical space for an empty string, which just left
 # a dead gap above VISUALISATION -- worse, not more minimal. The beat's
 # own brevity, 3.0s and no leader line, already does the "glance not a
 # chapter" work.)
 "hero": ((150, 900), "THE HARDWARE", "VISUALISATION", 0.35, (0, 0)),
 # RECOGNITION -- names a real waterfall in an unmodified frame; the
 # device identifying where the wearer is. No date, no history, no claim
 # beyond a place name and a river name, both visible in the frame. This
 # is now the ONLY on-screen graphic during the entire glasses-on
 # sequence (on/lock/anchor) -- it appears once, on `lock`, and is left to
 # simply persist/fade rather than being followed by a second, different
 # graphic on `anchor`, so the continuous take reads as one recognition
 # holding steady, not a slideshow of capabilities.
 "lock": ((880, 560), "THE FALLS", "BIG SIOUX RIVER", 0.9, (250, -330), 0.80),
}

# No ice grade anywhere in this cut. Empty, not deleted.
ICE = {}

# No generated-plate-that-is-already-frozen anywhere either. Empty, not
# deleted.
GEN_ICE = set()

# The score's structure, read out of the cut so it cannot drift from it.
# Four roles, not six: this arc is ONE rise and ONE release, not a four-
# act historical journey with an ice age in the middle.
SCORE = {
 "start":   "sign",     # the quiet montage begins here
 "lift":    "on",       # the glasses go on; the rise begins
 "peak":    "lock",     # recognition; the arc's high point, holds through anchor
 "release": "reach",    # he keeps walking; the score lets go with him
}


def figures(beat):
    """FIGURES rows, normalised to 10 fields.

    (image, foot_xy, height_px, appear_t, build, subj_depth, match,
     out_t, shadow, contact)

    out_t is when the figure leaves; None means it stays to the end of the
    beat. shadow is the ground-shadow strength, default 0.62. contact is
    the density of the patch directly under the feet, and None means "tie
    it to shadow". This cut's FIGURES is empty, so this always returns [].
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
