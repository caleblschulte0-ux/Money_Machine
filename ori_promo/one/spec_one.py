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
#
# V33 ADDENDUM (r145) -- THE ABOVE CALL WAS OVERRULED BY THE OPERATOR.
# "That one film fucked that. I didn't like how it was looking." The
# theory that fewer graphics reads more like an Apple ad did not survive
# contact with the actual operator watching the actual cut. `dak` is back
# (a full generated plate, same non-compositing approach `ice` used --
# see its BEATS entry below), and a new `table` beat adds the Apple
# product-reveal moment asked for by name. This is not v31 re-skinned
# either: no full era walkthrough, no "then vs now" reveal, no tagline
# change -- one AR-overlay example placed where the anchoring claim it
# illustrates already sits in the film, plus one new product beat. The
# "one continuous experience" idea above is UNCHANGED: on/lock/anchor is
# still one unbroken take with zero cuts inside it. What v33 rejects is
# the idea that AR content and restraint were the same thing -- they
# aren't, and the operator was the one who caught that they'd been
# treated as if they were.
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
#  - Runtime drops from 79.0s to 41.1s. Not a pacing accident -- cutting
#    four 7-8s era beats and not replacing them with anything of
#    equivalent length IS the concept. (A first pass landed at 35.0s
#    before real narration lengths pushed several beats back out --
#    `hero`, `lock` and `anchor` all grew once the first render showed
#    VO running 1.2-2.2s past a too-tight beat; see those beats' own
#    notes below. Still barely half of v31's runtime.) A tight, confident
#    spot in the low 40s is closer to an actual Apple product film (most
#    run 30-45s) than anything this project has cut before.
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
# v32b -- REAL-FOOTAGE REFRESH, same concept, different source clips.
# ChatGPT's r126 review (asked for by the operator's own "nothing similar"
# bar) made a sharp, evidenced point this file had missed: cutting the
# eras is a real conceptual break, but `sign`/`past`/`prod`/`walk` were
# still the EXACT SAME real clips at the EXACT SAME in-points every prior
# version had used, because this project has reused the same ~7 clips out
# of a much larger raw/ library since v18 and never actually looked at
# what else was shot that day. There are 27 other clips in raw/, most
# never opened. Surveyed them (thumbnails + full-res spot checks) and
# swapped four beats to footage that has never appeared in this film
# before:
#  - `sign`: IMG_6796 (the "FALLS PARK" info sign) -> IMG_6709, a
#    DIFFERENT plaque with different text (a poem, not the park-history
#    panel), shot close enough that no person is in frame at all --
#    changes the whole opening image, not just its pacing.
#  - `past`: IMG_6808 (static wide valley) -> IMG_6791, a slow panning
#    wide shot of the same empty riverbed from a different vantage --
#    same idea (nobody stopping), visibly different shot, and the pan
#    gives it motion the old static frame never had.
#  - `prod`: IMG_6799 (wearer, back to camera, static) -> IMG_6794, the
#    wearer at a completely different location (a round stone overlook
#    platform, not the falls' edge) who TURNS and gestures mid-clip --
#    same sunglasses prop as every other real shot in this project (
#    checked directly against IMG_6799 and IMG_6806's profile views,
#    same dark frame -- swapping the location does not introduce a
#    second, different-looking "product" by accident), but a dynamic
#    shot instead of a static one.
#  - `walk`: IMG_6807 (tight path shot) -> IMG_6805, a much wider plaza/
#    path composition from the same park, 93.7s long, with the falls
#    visible as a background element instead of the sole subject.
# `hero`, `on`/`lock`/`anchor` and `off` are UNCHANGED. `hero` has no real
# alternative (it is the one ChatGPT-generated product asset that exists,
# not a real-footage selection); `on`/`lock`/`anchor` is ChatGPT's own
# read of what's working ("keep the successful 0:13.5-0:25.5 continuous-
# interaction idea, because that is v32b's clearest new identity"); `off`
# was not specifically flagged and still does real narrative work (the
# "no phone in your face" beat needs the wide, uncluttered, UI-free frame
# it already has).
#
# FOOTAGE SAFETY FACTS (measured across v18-v32b; render_one.py's footage
# gate re-checks all of this at render time regardless):
#  - IMG_6803 (`off`) is 7.10s long; in-point 2.5 for MORE than ~3.5-4.0s
#    runs into the handheld drift as the original recording stops.
#  - IMG_6806 (`on`/`lock`/`anchor`) is one continuous 59.5s take; the
#    temple-reach gesture itself sits at 8.6-9.0s on the clip's own clock,
#    so `on`'s in-point (8.4) must not move later than that. `lock` and
#    `anchor` now pick up exactly where the beat before them left off on
#    THIS SAME CLIP'S CLOCK (10.9 = 8.4+2.5, 13.9 = 10.9+3.0) so the take
#    never repeats or skips a frame across the three beat names.
#  - IMG_6797 (`reach`) has room to spare at its existing in-point.
#  - The four v32b clips (IMG_6709, 6791, 6794, 6805) are new to this
#    film and were never covered by the old footage-safety notes. All
#    four are visually stable (checked by direct frame sampling across
#    their full length before use, not just at the chosen in-point) --
#    IMG_6709 and IMG_6791 barely move at all, IMG_6794's turn-and-
#    gesture is deliberate motion, not shake, and IMG_6805 has 93.7s of
#    runway at in-point 48.0. render_one.py's footage gate re-confirms
#    this numerically at every render regardless of this note.
W, H, FPS = 1920, 1080, 30
TOTAL = 55.6

# beat, clip, in-point, start, dur, what the beat does
BEATS = [
 # ---- COLD OPEN. The location card carries the "where" in text; VO stays
 # silent on `sign` so it isn't saying what's already on screen. v32b:
 # IMG_6709, a different plaque (a poem, not the park-history panel used
 # every prior version), close enough that no person is in frame.
 # IN-POINT FIXED, v32c pass 2 (this session's own fresh critical review,
 # not a note from either AI). tin=2.0 put the camera mid-pan across the
 # plaque: EVERY line of the paragraph was cropped on BOTH margins
 # mid-word ("s long as humans have inhabited this area, they" / "...rew
 # early American explorers...") and a second, unrelated plaque bled into
 # the bottom-right corner ("A tho... A tho... A tho..."). For a beat whose
 # whole job is "read close," the one thing on screen was not actually
 # readable. Sampled the full 28.2s clip frame-by-frame: the camera pans
 # right, and by tin=20.5 it has settled on a stable frame (checked
 # through 24.0, i.e. across this beat's whole 3.5s duration) where the
 # paragraph's actual opening is intact and legible left-to-right: "For as
 # long as humans have inhabited this area, they have been attracted by
 # the Falls." The second plaque is fully out of frame by this point too.
 # Right edge of later lines still clips (the plaque is wider than the
 # frame at this focal length throughout the whole clip -- checked, no
 # in-point avoids that), but a viewer can now read a complete opening
 # sentence instead of no complete sentence at all.
 # IN-POINT NUDGED 20.5 -> 22.3, same pass: render_one.py's own footage
 # gate (shotqc.py) flagged 20.5 JOLT (peak 18.3px) -- a brief handheld
 # settle ~1.1-1.2s into that in-point. Direct frame comparison before/
 # after the settle showed it was subtle, not a whip or bump, but the gate
 # exists precisely so a flag doesn't get eyeballed away when a clean
 # alternative costs nothing: 22.3 sits just past the settle, keeps the
 # exact same legible framing (verified same crop, same "For as long as
 # humans..." opening, second plaque still fully out of frame), and clears
 # the gate outright -- peak 5.1px, drift 1.0%, no flags.
 # r141 (ChatGPT's r140 review): the pass-2 fix above was checked against
 # a RAW, unletterboxed frame grab -- but every beat in this film gets
 # filmlook.py's standing 2.39:1 scope bars, which crop 12.8% off the top
 # and bottom of the ACTUAL delivered frame. This plate's paragraph starts
 # close enough to the top of its portrait source that the scope bar was
 # cutting the first line in the real render even though it read clean
 # unletterboxed -- ChatGPT caught this from the rendered evidence itself,
 # I hadn't re-checked my own comparison image closely enough to catch it
 # myself. The in-point (22.3) already sat on a stable, legible frame; the
 # fix is CROP (spec_one.py, applied by frames_of() before the render's
 # scale), not another in-point search -- no in-point changes how close to
 # the top of frame this plate's own text sits. See CROP["sign"] below.
 # CLAIM CORRECTED, r143 (ChatGPT's r142 review, again right): pass 3's
 # own note above overclaimed "legible left-to-right" -- every line, on
 # BOTH margins, still clips mid-word ("this a[rea]", "Rumors a[bout]"),
 # because the plaque is physically wider than this clip's field of view
 # at every point across its full 28.2s, not just at this in-point.
 # Checked for a way around it before accepting that: sampled the whole
 # clip a second time end to end (no wider moment exists, the camera pans
 # but never pulls back) and checked the surrounding HEIC stills
 # (IMG_6707/6708/6710-6714) for a second angle on the same plaque --
 # none exists; they are all wide park/river photos, not this sign. So
 # this is a real limit of the footage, not a framing choice, and no
 # crop or in-point fixes it. What IS true and worth keeping: the opening
 # WORDS of both paragraphs read clean top-to-bottom, clear of both scope
 # bars and the second plaque, which is a genuine improvement over pass 1
 # (mid-word on every axis, second plaque bleeding in) even though it
 # stops short of a complete, uncropped sentence. Beat description below
 # changed to match what is actually on screen -- an interpretive detail
 # of the plaque's text, not a claim that the full sentence reads.
 ("sign", "6709", 22.3, 0.0, 3.5, "a different plaque this time, an interpretive detail on its text -- not a full read, the plaque is wider than this clip's frame throughout"),
 # v32b: IMG_6791, a slow pan across the same empty riverbed from a
 # different vantage -- same idea (nobody stopping), different shot,
 # actual camera motion instead of a static frame.
 ("past", "6791", 3.0, 3.5, 2.5, "the park going by around it, nobody stopping -- panning wide, not static"),
 # `prod` v32b: IMG_6794, a different location (a round stone overlook,
 # not the falls' edge) where he turns and gestures mid-clip -- dynamic
 # instead of static. Same dark-sunglasses prop as every other real shot
 # in this project (checked against IMG_6799/IMG_6806's profile views),
 # so this does not introduce a second, different-looking "product."
 # Capped at 3.0s to match the beat's VO/timing budget below, not a
 # footage limit this time -- IMG_6794 runs 54.4s, room to spare.
 ("prod", "6794", 20.0, 6.0, 3.0, "the wearer, at a different overlook, turning toward the water"),
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
 # ---- `dak`, REINSTATED v33 (r145, operator override -- see the file
 # header). v31/v32 threw every historical-era beat out; the operator
 # rejected that whole direction outright and asked for AR-overlay content
 # back, pushed toward photorealism. dak_family_chatgpt.jpg is a v29 asset
 # that never got deleted, just stopped being referenced -- a COMPLETE
 # generated photograph (family + a Falls-Park-like background baked into
 # one image by ChatGPT itself, not a cutout composited by ai/place.py
 # onto real footage), same treatment `ice` used before the restart. It
 # goes back in verbatim, no new request needed. Positioned right after
 # the anchor/lock take resolves -- the film has just told you the glasses
 # anchor to the real place around you; this is the first concrete example
 # of what that means. TRIMMED 7.0 -> 4.5s (operator, after the crop/border
 # and ghosting were both fixed: "the pacing/edit rhythm is off"). Measured
 # the actual VO against it -- the line runs ~2.9-3.1s, so 7.0s was leaving
 # 3.5-4s of pure silent hold on a beat with two other, still-static
 # generated beats sitting right next to it. dak+mam together were eating
 # 13.0s of a 60.1s film on two largely still images back to back; that is
 # very likely what "rhythm feels off" was actually describing. 4.5s still
 # clears the VO with real margin, it just stops lingering after it.
 ("dak", "DAK1", 0.0, 24.3, 4.5, "an AR reconstruction of who stood at these falls before — VISUALIZATION, not a photograph"),
 # ---- `mam`, NEW v33 (r145, operator override): the other AR-overlay
 # example asked for by name ("woolly man[m]oth[s]... whatever it is
 # that they'll look at at the falls"). ai/mam/mammoth_falls_chatgpt.png
 # (r146) is the SAME kind of asset as dak_family_chatgpt.jpg -- one
 # complete generated photograph, the mammoth and the real Falls Park
 # riverbed/mill-ruins/bridge baked into a single image against the
 # pinned real-location reference, not a separate stylized environment
 # the way the old, unused ai/ice/ pollinations attempt was. Runs right
 # after `dak` -- two concrete examples of what "anchored to the real
 # place" can show you, back to back, then the film moves on.
 # TRIMMED 6.0 -> 4.0s, same pacing fix and same reasoning as `dak` above.
 ("mam", "MAM1", 0.0, 28.8, 4.0, "an AR reconstruction of how this ground looked before — VISUALIZATION, not a photograph"),
 ("reach",  "6797", 40.0, 32.8, 4.0, "he keeps walking; the capability keeps up with him"),
 # ---- THE CLOSE. No mid-film title card exists in this cut at all.
 # `off` EXTENDED 3.0 -> 3.8 (still inside the ~3.5-4.0s footage-safety cap
 # noted above) to give its own well-liked, unedited line more room.
 ("off",  "6803",  2.5, 36.8, 3.8, "glasses off, the real place, nothing drawn on it"),
 # ---- `table`, NEW v33 (r145, operator override): "have a scene where
 # the glasses come off of his face, and then they come into their own
 # scene where it's just the glasses, spinning on a table" -- an Apple
 # product-reveal beat, distinct from `hero`'s brief early glance.
 # ai/table/build_table_turntable.py: a REAL turntable, four r146
 # ChatGPT-generated angles of the same glasses_hero_chatgpt.jpg design
 # (front three-quarter, right profile, rear three-quarter, front/top),
 # swapped with a directional wipe (not a cross-dissolve -- an early pass
 # used xfade's plain "fade" and it ghosted badly between four angles
 # this structurally different, checked directly on extracted frames; a
 # slideleft wipe never overlaps two images at partial opacity, so there
 # is nothing left to ghost) -- not a synthesized spin out of one flat
 # image (build_table_plate.py's now-superseded first pass; see that
 # script's own header for why that would have failed the operator's
 # "obviously real" standard).
 ("table", "TABLE1", 0.0, 40.6, 6.0, "the hardware alone, turning through four real angles — the full reveal this time, not a glance"),
 # `walk` v32b: IMG_6805, a much wider plaza/path composition (93.7s
 # long -- picked in-point 48.0 for a clean, unpopulated frame with the
 # falls visible in the background) instead of IMG_6807's tighter path
 # shot every prior version used. Duration held at 5.0s (grew from 4.0s
 # on the first v32 pass for the same reason as before -- the closing
 # line was running into the silent end card at 4.0s).
 ("walk", "6805", 48.0, 46.6, 5.0, "a wider path/plaza, the falls in the background -- the closing line"),
 ("end",   None,   0.0, 51.6, 4.0, "held from walk's last frame — which is PRESENT DAY"),
]

# No beat needs the ice-age wearer mask -- there is no ice grade in this
# cut at all. Kept as an empty set (not deleted) because render_one.py
# still imports the name; it simply never matches.
WEARER_BEATS = set()

# The first act is the world BEFORE the product; the last act is after --
# a HUD over either would claim the glasses are on when they are not. The
# continuous on/lock/anchor take is deliberately EXCLUDED from this set:
# that is where the UI lives.
UI_OFF = {"sign", "past", "prod", "hero", "dak", "mam", "reach", "off", "table", "walk"}

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
 # VISUALIZATION disclosure, same as every generated image in this
 # project's history. SPELLING FIXED TO US, r134 (ChatGPT's active
 # fresh-look review): this is a Sioux Falls / US-audience film, and the
 # on-screen tag had been carrying the British spelling since it was
 # first written -- nobody had checked it against the intended audience
 # until this pass. (An earlier draft of this file tried a blank title
 # here to strip it of "chapter" weight; recon_block() still reserves a
 # full title-line of vertical space for an empty string, which just left
 # a dead gap above the tag -- worse, not more minimal. The beat's own
 # brevity -- still under half of v31's 5.0s hold -- and no leader line
 # already does the "glance not a chapter" work.)
 "hero": ((150, 900), "THE HARDWARE", "VISUALIZATION", 0.35, (0, 0)),
 # RECOGNITION -- names a real waterfall in an unmodified frame; the
 # device identifying where the wearer is. No date, no history, no claim
 # beyond a place name and a river name, both visible in the frame. This
 # is now the ONLY on-screen graphic during the entire glasses-on
 # sequence (on/lock/anchor) -- it appears once, on `lock`, and is left to
 # simply persist/fade rather than being followed by a second, different
 # graphic on `anchor`, so the continuous take reads as one recognition
 # holding steady, not a slideshow of capabilities.
 "lock": ((880, 560), "THE FALLS", "BIG SIOUX RIVER", 0.9, (250, -330), 0.80),
 # REINSTATED v33 (r145). Same disclosure discipline as `hero` -- a
 # generated plate always carries "VISUALIZATION", no exceptions, even
 # though this one is a full reconstruction rather than a product photo.
 # "THE DAKOTA" states who, nothing else -- no date, no headcount, no
 # claim about where or how they lived beyond standing at this river,
 # which the image itself shows. y=900 matches `hero`'s own position,
 # inside filmlook.safe_area()'s bottom bound (942 for this frame height).
 "dak": ((96, 900), "THE DAKOTA", "VISUALIZATION", 0.4, (0, 0)),
 # NEW v33 (r146 asset). Same disclosure discipline as `dak` right before
 # it -- names WHAT (a single animal, no headcount, no date), same
 # "VISUALIZATION" subtitle every generated image in this film carries.
 "mam": ((96, 900), "WOOLLY MAMMOTH", "VISUALIZATION", 0.4, (0, 0)),
 # NEW v33 (r145). Same label text as `hero` -- it is deliberately the
 # same object shown a second, fuller time, not a different product.
 "table": ((150, 900), "THE HARDWARE", "VISUALIZATION", 0.4, (0, 0)),
}

# Optional per-beat pre-scale crop: beat -> (x, y, w, h) in the SOURCE
# clip's own post-rotation pixel space, applied by render_one.py's
# frames_of() BEFORE the render's scale-to-1920x1080. Added for `sign`,
# r141 (ChatGPT's r140 review caught what r139 missed): filmlook.py's
# standing 2.39:1 scope bars crop 12.8% off the top and bottom of EVERY
# beat, film-wide -- not something to special-case away. IMG_6709 is a
# portrait phone shot whose own paragraph starts close enough to the top
# of its frame that a plain scale=1920:1080 (which maps the WHOLE 1080x
# 1920 source into 16:9, squishing but not cropping) put the paragraph's
# own first line inside that top 12.8% and the letterbox cut it, even
# though the same frame read clean before letterboxing. Cropping tighter
# around just the text block BEFORE the scale buys the headroom back: the
# same fixed 12.8%-per-side cut now lands in this crop's own margins
# instead of through the text.
#
# MARGIN WIDENED (0,70,1080,830) -> (0,0,1080,950), same r141 pass. The
# first version was checked against a single frame at this beat's OWN
# in-point (t=0 of the beat) and read clean there -- but this is live
# handheld footage with real per-frame jitter (shotqc.py's own gate
# measures it: mid 0.73px/frame at this in-point), and (0,70,1080,830)'s
# margin above the first line was only ~30px, not enough to survive that
# jitter across the beat's full 3.5s. Checked at t=0 it passed; checked a
# second later it didn't -- which is exactly the mistake r139's in-point
# fix made and r140 caught: one frame is not the beat. This crop was
# verified against 7 frames spanning the ENTIRE 3.5s duration (22.3s
# through 25.7s on the clip's own clock), each pushed through the same
# crop -> scale -> letterbox math the renderer applies, with all 4 lines
# of the opening sentence's paragraph clearing the top bar by ~50px+ at
# every sampled point, not just the first.
CROP = {
 "sign": (0, 0, 1080, 950),
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
