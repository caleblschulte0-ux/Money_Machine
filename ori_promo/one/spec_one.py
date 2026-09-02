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
TOTAL = 75.0

# beat, clip, in-point, start, dur, what the beat does
BEATS = [
 # ---- ACT 1: THE PROBLEM. Added v16 on the operator's ruling that the
 # film "has a third of what I needed" and must play to someone with no
 # idea what this is. The era demo was the whole picture; it answered
 # WHAT IT DOES and never WHAT IT IS, WHO WEARS IT, or WHY.
 # None of these beats carry generated imagery. They are the operator's
 # own footage, unmodified, and they exist to make the demo legible.
 ("sign", "6796", 29.0,  0.0, 6.5, "how the story is told today: a man reading a plaque"),
 # in-point 22.0, not 3.5. r101: "a large cropped person/body entering at
 # the far right/top edge... looks accidental". It did -- a headless torso
 # walking out of frame. 22.0 is the same locked-off plate (0.0% drift)
 # with the walkers small and whole in the middle distance, which is what
 # the line over it is actually about.
 # 28.8 looked better still -- two people walking right through the
 # foreground, literally the narration -- and the gate refused it at 75.8%
 # drift with a JOLT. The camera moves there. Recorded so nobody re-picks
 # it off a thumbnail.
 ("past", "6808", 22.0,  6.5, 4.0, "and the park going by around it, nobody stopping"),
 ("rail", "6790", 24.0, 10.5, 4.0, "the interpretive panel on the railing, the view right behind it"),
 # ---- ACT 2: THE PRODUCT. What it is, on a face, and the act of using it.
 # in-point 7.0, not 9.0. IMG_6799 is only 12.4s long and 9.0+5.0 runs
 # off the end of it; ffmpeg would have handed back a short beat and the
 # renderer pads, so this would have shipped as a freeze nobody flagged.
 ("prod", "6799",  7.0, 14.5, 5.0, "the wearer, the glasses on him, the whole park in front"),
 # ---- ONE CONTINUOUS SHOT, CUT INTO THREE BEATS. `on`, `lock` and `open`
 # are consecutive windows of IMG_6806 with no gap: 8.4-12.4, 12.4-16.4,
 # 16.4-21.4, all under 0.6% drift. So the whole causal chain -- he
 # reaches up to the temple, the glasses name what he is looking at, the
 # era rail arrives -- plays without a single cut, on one man in one
 # place.
 # The first attempt put the activation on IMG_6794@26.5 and it was
 # simply the wrong take: he turns and gestures at the camera with both
 # arms, which reads as "hey, look at this", not as operating a device.
 # 6806@8.8-10.0 is an unambiguous reach to the side of the head. Buying
 # that gesture is what moved `open` off its old 6.0 in-point -- same
 # clip, same locked-off framing, 10 seconds later in the take, so the
 # shot the operator approved is the shot that still plays.
 ("on",   "6806",  8.4, 19.5, 4.0, "he raises a hand to the temple — he is switching it on"),
 ("lock", "6806", 12.4, 23.5, 4.0, "the glasses recognise the falls and name them"),
 # ---- ACT 3: THE DEMO. LOCKED. Operator, on v15: "all the AI parts look
 # good enough to pass. Now don't mess with those anymore... don't lose
 # the AI scenes that you did AI overlays on because those are all... I
 # like those." These six beats are unchanged from v15 except that their
 # START TIMES shift by +27.5 to sit behind the new first act. Every
 # in-point, duration, figure, scale, grade and label is identical.
 ("open", "6806", 16.4, 27.5, 5.0, "the falls as they are, recognised — no rail, no menu"),
 # ---- `reach`: walking is the trigger now, not a drawn control. v18.
 # IMG_6797@40.0, gated clean (see the era-rail note above): mid 1.76
 # tail 1.35 ratio 0.77 drift 11.1% peak 4.0, no flags, never used
 # elsewhere in this film. UI stays off -- he has not switched anything
 # back on, he is simply walking -- and the past resolves on his arrival
 # in `dak`, not on a marker settling.
 ("reach", "6797", 40.0, 32.5, 3.5, "he walks, and the past is where he arrives"),
 ("dak",  "6804", 10.0, 36.0, 6.5, "before the mill, the family answers where he has stopped"),
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
 ("more", "6805", 70.3, 42.5, 4.5, "same era, a second group up by the mill ruin"),
 ("ice",  "6791", 14.0, 47.0, 4.0, "it runs further back and the whole valley freezes"),
 ("mam",  "6804", 26.0, 51.0, 6.0, "the payoff — the same shelf under ice, and a mammoth on it"),
 ("now",  "6804", 34.0, 57.0, 5.0, "back to NOW, the thaw, the closing line — no marker, just the dissolve"),
 # ---- ACT 4: THE CLOSE. The HUD is gone and the park is just the park
 # again, which is the only honest way to end a film about a device that
 # is not on your face right now.
 # NOT IMG_6798. r101: "the foreground railing and large no-climbing sign
 # dominate the frame, while the wearer's pointing gesture reads more like
 # a tourist snapshot than the quiet product payoff." All three are true
 # of that plate. 6803 is the overlook: him at the rail, the whole park
 # and the falls in front of him, no signage, no gesture -- a man simply
 # looking at a place, which is the entire closing claim.
 ("off",  "6803",  2.5, 62.0, 4.5, "glasses off the story, the real place, nothing drawn on it"),
 ("walk", "6807", 12.0, 66.5, 4.5, "the closing line over the park as it actually is"),
 ("end",   None,   0.0, 71.0, 4.0, "held from walk's last frame — which is PRESENT DAY"),
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
UI_OFF = {"sign", "past", "rail", "prod", "reach", "off", "walk"}

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
 # 529px at y=830, not 300px at y=930. OPERATOR, on v14: "This is bad
 # sizing on the ai image they are the size of a dog." He was right and it
 # is measurable, and the measurement is the thing I said in r95 this
 # plate could not give me. I was wrong: I looked only at the FRAME the
 # beat cuts from, where the only human stands on the elevated walkway.
 # The CLIP is 93 seconds long and barely moves (0.2% drift), so the whole
 # of it is the same camera. Background-differencing against an empty
 # frame finds real people walking the near lawn and path:
 #     14s  464px tall, feet at y=773
 #     44s  544px tall, feet at y=848
 #     50s  273px tall, feet at y=670
 # Least squares through those three gives a horizon at y=488 and a scale
 # of 1.547px per row, so an adult standing at y=930 is 684px. The group
 # was 300px -- 44% of human size, which is very close to half, which is
 # why it read as animals rather than people.
 # THE FEET GO TO 830, NOT 930, and that is the rail's doing, not taste.
 # At the correct 684px the group is 438px wide, so clearing the scrim
 # (which covers y 832-928 across x 470-1450) needs x>=1669, and that puts
 # its right edge 32px off the frame -- jammed into the corner r94 already
 # called "visually fragile". Standing them one row band further back is
 # the same geometry honestly applied: 830 is the last row whose figure
 # ends ABOVE the scrim, and 1.547*(830-488) = 529.
 # Verify the plane before changing this: scripts are not needed, just
 # diff any frame of IMG_6805 against t=80s and measure who is walking.
 "more": [("ai/era/dak_s3.jpg",  (1600, 830), 529, 1.0, 1.2, 0.30, 0.45)],
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
 # anchor follows the group up the bank -- it pointed at y=962, which is
 # now empty ground below a figure that starts at 830.
 "more": ((1430, 846), "SAME DAY",        "VISUALISATION", 2.4, (-70, -300)),
 "ice": ((520, 760),  "THE LAST ICE",    "VISUALISATION", 2.4, (40, -300)),
 # RECOGNITION, and it is a different KIND of label from the three above.
 # Those name a generated era and are subtitled VISUALISATION because
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
