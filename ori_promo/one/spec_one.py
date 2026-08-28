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
TOTAL = 34.5

# beat, clip, in-point, start, dur, what the beat does
BEATS = [
 ("open", "6806",  6.0,  0.0, 5.0, "the falls as they are. the system comes up, the era rail appears"),
 ("dak",  "6804", 10.0,  5.0, 6.5, "the scrub reaches BEFORE THE MILL and the family answers"),
 # SAME ERA, DIFFERENT PLACE. The operator asked for "one more that has
 # Indians and shit", and the useful way to add it is not a second
 # unrelated tableau -- it is to LOOK AROUND inside the era already
 # selected. The rail does not move on this beat, which is the point: the
 # wearer has not changed time, he has turned his head, and the past is
 # still there when he does. That is a product claim the film had not yet
 # made.
 # PLATE CHANGED, and the reason is a rule now enforced in code.
 # OPERATOR on v11: "The Indian one looks like shit ... don't use a
 # panning shot for the ai overlays." IMG_6687@24 drifts 16.7% over this
 # beat. I picked it on composition and never looked at the drift I had
 # already measured. A tracked figure on a panning plate slides against
 # ground that is itself moving, and no amount of anchoring hides it.
 # render_one now REFUSES to render a beat that places a figure on a
 # plate over FIGURE_MAX_DRIFT.
 # Sweeping all 34 clips for genuinely static windows turned up an
 # uncomfortable fact worth recording: the good-looking park vistas --
 # the falls, the shelf, the valley -- were all shot as PANS. The only
 # static plates with ground at figure scale are the hero shelf (6804)
 # and this lawn below the mill ruin (6805, 0.2% drift).
 ("more", "6805", 70.3, 11.5, 4.5, "same era, a second group up by the mill ruin"),
 ("ice",  "6791", 14.0, 16.0, 4.0, "it runs further back and the whole valley freezes"),
 ("mam",  "6804", 26.0, 20.0, 6.0, "the payoff — the same shelf under ice, and a mammoth on it"),
 ("now",  "6804", 34.0, 26.0, 5.0, "the scrub returns to NOW, the thaw, the closing line"),
 ("end",   None,   0.0, 31.0, 3.5, "held from now's last frame — which is PRESENT DAY"),
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

# beat: (image, foot_xy, height_px, appear_t, build, subj_depth, match
#        [, out_t][, shadow][, contact])
# Heights stay in the 300-390 band on the two figure plates. The mammoth
# is smaller because it stands on the FAR ledge across the water, and at
# that distance an animal reads by silhouette.
FIGURES = {
 "dak":  [("ai/era/dak_s17.jpg", (1150, 745), 385, 1.4, 1.4, 0.30, 0.55)],
 # dak_s3, not a reuse of s17 and not dak_s41 -- s41's headwear reads as
 # ceremonial and r78 was explicit that this depiction stays ordinary and
 # non-spectacle. s3 is the same register as s17: mixed ages, plain
 # garments, everyone's feet on the rock.
 # beside the quartzite outcrop rather than adrift on mown grass -- the
 # settlers failed on this same plate partly by standing in open lawn
 # with nothing to be near.
 # x=1600, clear of the era rail. At (1320, 930) the rail's scrim -- it
 # covers y 832-928 across x 470-1450 -- cut straight through the group's
 # legs and hid their feet, which is the one part of a composite that has
 # to be visible. The HUD sits at the bottom of a 2.39 frame and figures
 # standing on near ground sit there too; they have to be kept out of
 # each other's way by placement, since the HUD is drawn over everything.
 # y=930, not 955. Moving this group clear of the rail's scrim pushed
 # its FEET INTO THE BOTTOM LETTERBOX BAR -- the active picture ends at
 # 942. I fixed one collision and created another, and r92 caught it:
 # "their feet are scope-clipped". render_one now asserts every figure
 # fits inside the scope frame.
 # THE PALE AREA AROUND THIS GROUP IS THE MILL RUIN. IT IS NOT AN
 # ARTIFACT, AND IT IS NOT MINE TO REMOVE.
 # r94 read it as "a rectangular local plate or erased region extending
 # toward the right edge" and asked for it to be cleaned up. It is the
 # quartzite foundation of the mill and the ring of sun-bleached dead
 # grass around it, photographed. Three measurements settle it, and they
 # are recorded here so nobody spends another round on it:
 #   1. Differencing the composited frame against the same graded plate
 #      shows changed pixels ONLY inside the figures' silhouette and their
 #      cast shadow. Nothing outside is touched.
 #   2. Sampling rings outward from the alpha, the composite makes every
 #      ring DARKER (-6.2, -7.9, -13.4, -6.8, -0.9 luma at 0-6, 6-16,
 #      16-30, 30-60, 60-110 px). It never lightens anything.
 #   3. The plate's own luminance in those same rings is 180, 175, 167,
 #      142, 116. The pale region is in the photograph and falls off with
 #      distance from the group -- because the group is standing on it.
 # So the honest description is a PLACEMENT fact, not a defect: they are
 # standing on the brightest ground in that corner, and the eye reads
 # figure-plus-bright-surround as one pasted object. Moving them onto
 # continuous lawn is the fix, and it is BLOCKED, for two stated reasons:
 # at this depth the only ground clear of the era rail's scrim IS the ruin
 # apron (see the x=1600 note above), and standing them further back needs
 # a ground-plane scale this plate cannot supply -- the only human in the
 # shot is on the elevated walkway above the retaining wall, not on the
 # lawn, so there is no same-plane reference to solve the horizon from.
 # Guessing a height here is the mistake that produced "the mammoth size
 # is shit". It needs a locked-off plate, or the operator's call.
 # It is also, for what it is worth, the right place for them to be
 # standing in a beat captioned BEFORE THE MILL.
 "more": [("ai/era/dak_s3.jpg",  (1600, 930), 300, 1.0, 1.2, 0.30, 0.45)],
 # 560px, not 320. OPERATOR: "the mammoth size is shit" -- and it was,
 # measurably. The Dakota family on THIS PLATE is 385px at y=745 and he
 # approved that as human scale, so the ground plane is known: at y=690 a
 # person is ~308px, and a mammoth stands about twice a person, so ~600px.
 # 320 was half the size of the animal it claimed to be, which is why it
 # read as a large dog on a rock shelf.
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
 "dak":  ((1032, 752), "BEFORE THE MILL", "VISUALISATION", 2.9, (-40, -410)),
 "more": ((1470, 962), "SAME DAY",        "VISUALISATION", 2.4, (-70, -330)),
 "ice": ((520, 760),  "THE LAST ICE",    "VISUALISATION", 2.4, (40, -300)),
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

# ---- THE ERA RAIL: the thing that was missing.
# r88, and it is the best note this film has had: "The overlays arrive as
# DEMONSTRATIONS INSTEAD OF CONSEQUENCES OF AN ACTION. The missing feeling
# is agency, anticipation, and payoff: notice the rock, choose or scrub an
# era, watch the place answer, then return changed to the present."
# The structure was present / image / ice / animal / present. Nothing on
# screen ever DID anything -- eras simply appeared because the edit said
# so. A drawn scrub rail fixes that with no new assets: the marker MOVES
# FIRST and the world answers behind it, so every era is caused rather
# than delivered, and the return to now is an action the viewer watches
# rather than a cut they are handed.
# stops: label and x position along the rail, 0..1 from NOW to deep time.
SCRUB_STOPS = [("NOW", 0.0), ("BEFORE THE MILL", 0.5), ("THE LAST ICE", 1.0)]

# (film_time, position). Linear between keys; the marker always arrives
# BEFORE the beat it causes.
# EVERY ARRIVAL GETS 0.5s OF UNCONTESTED LEAD. r90: "the documented
# 0.1-0.2 second marker lead is only 3-6 frames at 30 fps. That is too
# brief for a first viewer to register 'the wearer selected a time, then
# the world responded'." Correct, and one of the three was worse than
# brief -- it was BACKWARDS. The thaw began at 22.2 while the marker was
# still travelling and did not reach NOW until 23.4, so the world changed
# and then the control caught up with it. The order the viewer must see is
# marker moves -> marker SETTLES -> world changes, and it now reads:
#     arrives 5.9  settles 6.05  family resolves 6.4   (0.50s lead)
#     arrives 12.0 settles 12.15 valley freezes 12.5   (0.50s lead)
#     arrives 22.3 settles 22.45 thaw begins 22.8      (0.50s lead)
# The time comes out of the holds, not out of the running time.
SCRUB_KEYS = [
 (0.0, 0.0), (5.4, 0.0),
 (5.9, 0.5),                       # family resolves 6.4  (0.50s lead)
 (15.5, 0.5),                      # ...and does NOT move across `more`
 (16.0, 1.0),                      # valley freezes 16.5  (0.50s lead)
 (25.6, 1.0),
 (26.3, 0.0),                      # thaw begins 26.8     (0.50s lead)
]
# (appear, fade-in, start of fade-out, fade-out length). r90: "keep the
# rail through the NOW settle and the first beat of thaw, then fade it."
SCRUB_FADE = (2.0, 1.0, 27.6, 0.9)
SCRUB_SETTLE = 0.15                # marker pulses this long on arrival

SCORE = {
 "start":  "open",
 "arrive": "dak",
 "lift":   "dak",
 "hold":   "more",
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
