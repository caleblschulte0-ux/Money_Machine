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
TOTAL = 50.5

# beat, clip, in-point, start, dur, what the beat does
#
# ---- v19: THE FRONT END WAS TOO LONG. Operator, on v18: "way too much
# b roll on the front end, we don't even see an ai overlay until the
# last half of the video, and we don't breakdown what makes our product
# special." All three are correct and measurable: v18 ran 36.0 of 75.0
# seconds (48%) before the first generated overlay. The operator's own
# ORIGINALLY APPROVED 34s cut (ori_promo/README.md) reached its first AI
# overlay at 14.5 of 34s (43%) and ran THREE distinct capability beats
# back to back. v18 had drifted past that pace across six versions of
# additions nobody re-checked against the total.
#
# THE FIX IS COMPRESSION, NOT A REWRITE. Same clips, same in-points where
# a beat carries generated imagery (changing those would mean re-gating
# figure placement), shorter durations everywhere else, and `rail` CUT
# entirely -- it was a third establishing beat making the same point
# `sign` and `past` already make (the story is here and unseen), and
# every second spent there is a second not spent on the product. Every
# shortened window was re-gated (shotqc.py, unmodified): all PASS, no
# flags, same as the durations they replace.
#
# THE MISSING BREAKDOWN: `open`'s line changes from "So take the falls,
# and run them backwards" -- a transition, not a claim -- to the
# operator's OWN approved capability language from that original cut:
# "the history, pinned to the exact spot where it happened." Paired with
# `lock`'s unchanged "They know where you're standing, and what you're
# looking at," that is two consecutive, concrete statements of what the
# device does, immediately before the film proves both of them. Nothing
# invented -- this is the operator's own vetted line, reused, not new
# copy written on his behalf.
BEATS = [
 # ---- ACT 1: THE PROBLEM. Fast. Two beats, not three.
 ("sign", "6796", 29.0,  0.0, 3.5, "how the story is told today: a man reading a plaque"),
 # in-point 22.0, not 3.5 (r101: a headless torso walked out of frame at
 # 3.5). Same note as v16/v17/v18 -- kept here so nobody re-picks the bad
 # in-point off a thumbnail. 28.8 gates DRIFT+JOLT; still refused.
 ("past", "6808", 22.0,  3.5, 2.5, "and the park going by around it, nobody stopping"),
 # `rail` IS GONE. v19. It was a third shot making the point `sign` and
 # `past` already make. Its VO line is gone with it, not folded into
 # another beat -- the film does not need to say "the story is right
 # there, you just can't see it" a third way when it has already said it
 # twice and is one beat from showing the product that fixes it.
 # ---- ACT 2: THE PRODUCT. What it is, on a face, and the act of using
 # it -- compressed, but the SAME footage: in-point 7.0 on IMG_6799,
 # same reason as always (the clip is only 12.4s long).
 ("prod", "6799",  7.0,  6.0, 3.0, "the wearer, the glasses on him, the whole park in front"),
 # ---- ONE CONTINUOUS SHOT, STILL CUT INTO THREE BEATS, JUST SHORTER.
 # `on`, `lock` and `open` are consecutive windows of IMG_6806 with NO
 # GAP -- 8.4-10.7, 10.7-13.2, 13.2-16.4 -- so the in-points are DERIVED
 # from each other's end, not reused from v18's longer windows; reusing
 # the old fixed in-points here would have jump-cut within one take. The
 # temple-reach gesture itself is a fixed point in the SOURCE footage
 # (8.6-9.0 on IMG_6806's own clock) and both new durations still cover
 # it, so the causal chain -- reach, recognise, reveal -- is intact, just
 # faster.
 ("on",   "6806",  8.4,  9.0, 2.3, "he raises a hand to the temple — he is switching it on"),
 ("lock", "6806", 10.7, 11.3, 2.5, "the glasses recognise the falls and name them"),
 ("open", "6806", 13.2, 13.8, 3.2, "anchored to the real place — the capability, stated correctly"),
 # ---- `map`: THE SITE MAP, v21. Operator: "it needs that sky view map
 # that kinda shows what points in the falls we would be doing what, which
 # I made and gave you... if you don't like the way it looks, fine, but
 # then you need to generate something that looks very similar and just
 # better. In that minimalist map you tried to do at one point -- not
 # that. That didn't work, I didn't like it." His original file could not
 # be re-sent into this session, so this is built from HIS CONCEPT (a
 # colour-coded legend: blue=visual scenes, purple=audio narration,
 # orange=ambient noise, green=lookout points) on a REAL aerial-style
 # photo of the actual park, not the darkened/minimalist treatment he
 # rejected and not a stock or generated satellite image. The photo is
 # ORI'S OWN footage: the clean upper portion of IMG_6803 (the same clip
 # `off` uses two beats later), the one moment in that clip before the
 # wearer leans onto the rail where the whole park -- mill ruin, falls,
 # paths, green fields, city skyline -- is unobstructed. See
 # one/map_overlay.py for the pin placement and ai/map/park_map_plate.png
 # for the built plate. This is a STATIC card, held for the whole beat
 # (like `end`), not a panned or zoomed plate -- a photo card does not
 # need to move to read, and holding it keeps every pin anchor a fixed
 # pixel rather than a tracked one.
 ("map",  "MAP1",  0.0, 17.0, 4.5, "the site map — his own legend, on the real park"),
 # ---- `reach`: walking is the trigger, not a drawn control. v18, timing
 # only compressed in v19. IMG_6797@40.0, gated clean at every duration
 # tried (see rounds/r106): mid 1.87 tail 1.76 ratio 0.94 drift 7.8% peak
 # 4.0 at 2.5s, no flags. Start moved 17.0 -> 21.5, v21, to make room for
 # `map`.
 ("reach", "6797", 40.0, 21.5, 2.5, "he walks, and the past is where he arrives"),
 # ---- ACT 3: THE DEMO. `dak` AND `more` ARE GONE. v20, on direct
 # operator instruction, and this is a REMOVAL, not a taste note.
 # Operator, asked directly whether there is a Dakota cultural advisor or
 # tribal contact attached to this project: "There is not currently a
 # Dakota cultural advisor or tribal partner attached to the project that
 # I can point to as having reviewed and approved the reconstruction...
 # I would remove any detailed or authoritative-looking Dakota
 # reconstruction from the core demo for now... pull the specific Dakota
 # reconstruction. Once we have cultural involvement, put it back
 # correctly and make it stronger." A VISUALISATION disclaimer does not
 # answer that; he said so himself, and he is right -- a disclosure tag
 # is a label on the frame, not a review of what the frame depicts. Both
 # generated Dakota figures (dak_s17.jpg, dak_s3.jpg) and both beats that
 # carried them are removed from this cut. No substitute reconstruction
 # was invented in their place -- see FIGURES and LABELS below, and the
 # (unchanged) mam41f.jpg mammoth is the only composited figure left in
 # the film, because it depicts an animal, not a culture.
 # This SHRINKS the demo section right after v19 lengthened it in
 # response to "we don't breakdown what makes our product special" --
 # that tension is real and is not resolved by pretending otherwise. The
 # breakdown v19 added (the two capability lines on `lock`/`open`) stays
 # and does the explaining; the remaining ice/mammoth beat is the one
 # demonstration this cut can make honestly today.
 ("ice",  "6791", 14.0, 24.0, 4.0, "it runs further back and the whole valley freezes"),
 ("mam",  "6804", 26.0, 28.0, 6.0, "the payoff — the same shelf under ice, and a mammoth on it"),
 ("now",  "6804", 34.0, 34.0, 5.0, "back to NOW, the thaw, the closing line — no marker, just the dissolve"),
 # ---- ACT 4: THE CLOSE. The HUD is gone and the park is just the park
 # again, which is the only honest way to end a film about a device that
 # is not on your face right now.
 # NOT IMG_6798. r101: "the foreground railing and large no-climbing sign
 # dominate the frame, while the wearer's pointing gesture reads more like
 # a tourist snapshot than the quiet product payoff." All three are true
 # of that plate. 6803 is the overlook: him at the rail, the whole park
 # and the falls in front of him, no signage, no gesture -- a man simply
 # looking at a place, which is the entire closing claim.
 # DURATION 4.5 -> 3.0, v21. Operator: "cut it a little sooner because it
 # starts to wobble." IMG_6803 is only 7.1s long and this beat's old
 # window (2.5-7.0) ran to within 0.1s of the clip's own end -- exactly
 # where a handheld shot drifts as the recording stops. Confirmed both
 # ways: shotqc's tail motion at 4.5s is 0.58 (ratio 3.89, accelerating
 # hard); frame-by-frame from 6.2-7.0s shows the framing visibly sliding
 # right. At 3.0s (in-point unchanged) tail drops to 0.11, ratio 0.76 --
 # stops before the drift starts. Checked every other beat's tail the
 # same way (measurement + frames, not just the flag): none of the rest
 # show it. `reach` and `ice` have real absolute tail motion too (1.76,
 # 1.01) but it is the WALKING SUBJECT and a legitimate pan respectively,
 # confirmed by looking at the frames -- not a settle-down artifact.
 ("off",  "6803",  2.5, 39.0, 3.0, "glasses off the story, the real place, nothing drawn on it"),
 ("walk", "6807", 12.0, 42.0, 4.5, "the closing line over the park as it actually is"),
 ("end",   None,   0.0, 46.5, 4.0, "held from walk's last frame — which is PRESENT DAY"),
]

# Beats with a present-day person close enough to hold OUT of the ice
# grade. The wide valley has nobody near camera, and on that plate the
# depth threshold grabs 22% of the frame -- the foreground rock -- and
# would have left a raw summer-coloured slab across the bottom of an ice
# age. A mask built for one plate is not a mask for every plate.
WEARER_BEATS = {"mam", "now"}

# v6 ran the opening montage without the viewfinder because it was
# documentary B-roll claiming nothing. v7 had no montage: every beat was
# the device looking at something, so the UI belonged on all of them.
# v16 HAS A MONTAGE AGAIN, and the rule is back with it — sharper.
# The first act is the world BEFORE the product: a man reading a plaque,
# a park going by, a sign on a railing. Drawing the device's HUD over
# those frames would say the glasses are already on and quietly destroy
# the only thing act one is for, which is showing what it is like without
# them. The last act is the same in reverse: he has looked, the film is
# over, and a HUD on the closing frames would claim the device is still
# running when the point is that you just look.
UI_OFF = {"sign", "past", "prod", "reach", "off", "walk"}

# beat: (title, subtitle, appear_t[, scale]) — the film's own voice, drawn
# bottom-left with a scrim, no reticle and no leader line.
TITLES = {
 # The location card moves to the FIRST frame of the film, not to `open`.
 # With an act in front of it, a viewer who is told where they are only
 # 25 seconds in has spent 25 seconds not knowing.
 "sign": ("FALLS PARK", "SIOUX FALLS, SOUTH DAKOTA", 0.6),
 "now":  ("ONE PLACE", "EVERY TIME", 2.2, 1.3),
}

# beat: (image, foot_xy, height_px, appear_t, build, subj_depth, match
#        [, out_t][, shadow][, contact])
# Heights stay in the 300-390 band on the two figure plates. The mammoth
# is smaller because it stands on the FAR ledge across the water, and at
# that distance an animal reads by silhouette.
FIGURES = {
 # "dak" and "more" (dak_s17.jpg, dak_s3.jpg) REMOVED, v20. Operator,
 # asked directly whether a Dakota cultural advisor or tribal contact is
 # attached to this project: "There is not currently a Dakota cultural
 # advisor or tribal partner attached to the project that I can point to
 # as having reviewed and approved the reconstruction... I would remove
 # any detailed or authoritative-looking Dakota reconstruction from the
 # core demo for now... Once we have cultural involvement, put it back
 # correctly and make it stronger." Removed, not disabled -- everything
 # this block used to say about their placement (the mill-ruin ground
 # plane, the 529px/44%-of-human-size measurement, the era-rail scrim
 # collision) is now dead weight and has been deleted with the entries.
 # If those assets return, they return with a cultural review attached,
 # not by uncommenting this.
 # 560px, not 320. OPERATOR: "the mammoth size is shit" -- and it was,
 # measurably. The scale is a HISTORICAL record now, not a live
 # dependency: the calibration figure (the Dakota family that used to
 # stand on this same plate at 385px/y=745, operator-approved as human
 # scale) is gone, per the removal note above, but the arithmetic it
 # produced does not need it anymore -- at y=690 a person is ~308px, and
 # a mammoth stands about twice a person, so ~600px. 320 was half the
 # size of the animal it claimed to be, which is why it read as a large
 # dog on a rock shelf.
 # The 9th field is SHADOW STRENGTH, and it is here because scale broke
 # it: the cast shadow is projected from the figure's own alpha, so at
 # 560px it grew into a 240px black slick lying across white ice. 0.34
 # keeps the ground contact and loses the bar. Snow takes a far softer
 # shadow than sunlit quartzite does.
 # feet at 730, not 690. At 560px tall its head reached y=130 and the
 # active picture starts at 138 -- the mammoth has been decapitated by the
 # top bar since scope came in, and it also collided with the disclosure
 # band. r92 is explicit that the SCALE is right and must not go back, so
 # the animal moves down the shelf instead of shrinking.
 # match 0.22, not 0.45. r94: the animal "is uniformly soft and milky
 # compared with the rock plane". That was arithmetic, not taste. The
 # light match pulls the cutout toward the mean and spread of the plate it
 # lands on, and this plate is SNOW: subject mean ~75, plate mean ~191. At
 # 0.45 the animal's mean was lifted to ~127 and its contrast scaled by
 # ~0.86 -- a milky veil and a flattening, applied on purpose by a
 # function whose whole job is to stop the sticker look. Matching a dark
 # heavy animal to a white background is the one case where the cure is
 # the disease: in snow a mammoth genuinely IS much darker than
 # everything around it, and that contrast is the realism. 0.22 keeps the
 # cool bounce a real animal would take from the snow and nothing else.
 # The 10th field is CONTACT, split out from shadow strength because the
 # two wanted opposite things here. See ai/place.py: at 560px the cast
 # projection becomes a slick across white ice at any density that would
 # read under the feet, so shadow strength stays at the 0.34 that keeps
 # the slick soft, and contact carries the ground patch at 0.72.
 "mam": [("ai/era/mam41f.jpg",  (1330, 730), 560, 2.2, 1.0, 0.30, 0.22, None, 0.34, 0.72)],
}

LABELS = {
 # "dak" and "more" LABELS REMOVED with their figures, v20 -- see the
 # removal note in FIGURES above. "THE LAST ICE" stays: it names the ice
 # AGE, not a reconstructed culture, and mam41f.jpg is an animal, not a
 # person.
 "ice": ((520, 760),  "THE LAST ICE",    "VISUALISATION", 2.4, (40, -300)),
 # RECOGNITION, and it is a different KIND of label from the one above.
 # That one names a generated era and is subtitled VISUALISATION because
 # something drawn is on screen. This one names a real waterfall in an
 # unmodified frame: it is the device identifying what the wearer is
 # actually looking at, which is the step the film was missing. A viewer
 # who has never seen this product needs to be shown that the glasses
 # know WHERE HE IS before being shown that they can move him through
 # time, or the era rail arrives as a magic trick.
 # No date, no history, no claim — a place name and a river name, both
 # plain geography, both visible in the frame.
 # r101: "oversized and crowded against the wearer's head and upper-right
 # frame". Correct on both counts. The 6th field is a label SCALE and this
 # is the only label that uses it: 0.80, and the card lifts and moves left
 # so there is clear sky between it and his head. The era labels keep
 # their full weight -- announcing an era has earned it, naming the
 # waterfall you are already looking at has not.
 "lock": ((880, 560), "THE FALLS", "BIG SIOUX RIVER", 0.9, (250, -330), 0.80),
}

# beat -> (in_start, in_end, out_start, out_end); out may be None.
# The ice arrives on `ice`, is simply PRESENT on `mam` (it did not thaw
# between two shots of the same era), and leaves on `now` so the film
# returns to the present on screen rather than on a cut.
ICE = {
 # r88: 13 of 33.5 seconds were ice, "38.8% of the film in two
 # consecutive, visually similar blue-white beats". Now 10 of 30.5 --
 # 4s for the transformation, 6s for the payoff.
 # The freeze also STARTS LATE (0.5s in) so the scrub marker reaches THE
 # LAST ICE before the world answers, not after.
 "ice": (0.5, 2.3, None, None),
 "mam": (-1.0, 0.0, None, None),
 "now": (-1.0, 0.0, 0.8, 2.4),
}

# ---- THE ERA RAIL IS GONE. v18, on the operator's ruling.
# The rail (SCRUB_STOPS/SCRUB_KEYS/SCRUB_FADE, draw_rail() in
# render_one.py) drew a scrubbable timeline -- three labelled stops and a
# marker the wearer appeared to operate. It answered r88's real note ("the
# overlays arrive as demonstrations instead of consequences of an
# action") but it answered it with a WIDGET, and the operator's own
# concept document says the opposite of a widget:
#   SS5  "Instead of: Tap 'Chapter 2.' It's more like: Walk to Chapter 2."
#   SS14 "ORI is not a floating museum touchscreen. Don't fill the
#        person's vision with cards, menus, buttons and dashboards."
# draw_rail's own docstring already said the quiet part: "Anything more
# decorative would read as a video-editor timeline pasted over a park."
# It was a timeline pasted over a park. Removed entirely -- no rail is
# drawn on any beat now.
#
# The causal fix r88 was actually asking for -- action BEFORE consequence
# -- is now WALKING, not a control widget, because that is what the
# operator's own footage can show without inventing anything. See `reach`
# below.
#
# The per-era captions (LABELS: "BEFORE THE MILL", "SAME DAY", "THE LAST
# ICE") are UNCHANGED and stay. Those are placards naming what is on
# screen, the same kind of information a museum wall card carries; the
# thing removed is the OPERABLE part, not the informational part.
#
# ---- THE WALK, NOT THE RAIL: `reach`.
# One new beat, inserted between `open` and `dak`, on THREE static plates
# gated the same way every other cut in this film is gated (shotqc.py,
# unmodified; see rounds/r106__claude__walk_footage_gate.txt for the full
# table). IMG_6797@40.0 is a clean 4.0s window (mid 1.76 tail 1.35 ratio
# 0.77 drift 11.1% peak 4.0, no flags) of him walking, never used
# elsewhere in this film. UI is off across it, same rule as the rest of
# act 1/2 -- he has not switched anything on again, he is simply walking,
# and the past resolves on his arrival rather than on a marker settling.
# This is ONE walk beat, not a rebuild of every era-to-era jump: the four
# internal jumps (dak->more->ice->mam->now) stay dissolve-only, carried by
# VO and the per-era captions, which is an honest, smaller claim than
# restaging "walk to chapter 2" four more times on footage that does not
# exist for it (no plate shows him walking BETWEEN two distinct era
# locations -- these are all separate short takes, not one continuous
# walk-and-arrive traverse). Overstating this beyond the one clean cut
# would be exactly the kind of invented capability rule zero forbids.

SCORE = {
 # v16: "start" is the FIRST FRAME OF THE FILM, not the first frame of the
 # demo. It pointed at `open`, which is now 28 seconds in, so the whole
 # first act sat below the montage floor while the score waited for a beat
 # that had three other acts in front of it. The roles are looked up, so
 # this one edit re-times the entire arc.
 "start":  "sign",
 # v20: "arrive"/"lift"/"hold" pointed at "dak"/"dak"/"more", both gone
 # (see FIGURES). `reach` is now where the swell happens -- he arrives,
 # the score lifts, in the same beat, matching the score's own v7 note
 # that arrive and lift were once the same beat by design. The swell
 # completes inside `reach`'s own short runtime (ramp() clips past its
 # target, so a beat shorter than the ramp's 2.0s just means the plateau
 # is reached a little early, not that anything breaks), and "hold" is
 # `ice` itself: since ice_st == the hold beat's own start, the plateau
 # segment is zero-width by construction and the swell hands off directly
 # into the cold descent with no gap and no double-write. Checked by
 # running score_one.py and reading the printed arc, not by inspection.
 "arrive": "reach",
 "lift":   "reach",
 "hold":   "ice",
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
    it to shadow", which is what every figure did before the mammoth
    needed the two separated. All three are OPTIONAL trailing fields so
    shorter rows keep working untouched -- FOUR modules unpack these
    tuples (render_one twice, assemble_one, timeline_one) and widening
    them all at once is how a positional-argument bug renders fine and
    means something else.
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
