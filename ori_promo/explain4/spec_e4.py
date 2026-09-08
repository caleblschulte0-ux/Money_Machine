# ORI EXPLAINER #4 of 5 -- "THE Q&A" (literal question-and-answer style)
#
# Same r145 mandate as explain1/2/3: five different STYLES of a full,
# self-contained explainer, all serving the identical purpose -- someone
# with zero ORI context understands it top to bottom. v32c stays a 41s
# teaser, untouched. explain1 is calm documentary (full sentences),
# explain2 is fast kinetic captions (fragments), explain3 is a cinematic
# trailer (short rhetorical lines, sparse titles). THIS one is a
# different STRUCTURE, not just a different pace: every beat poses an
# explicit on-screen QUESTION as its title ("WHO OWNS IT?", "IS IT LIVE
# YET?", "DOES IT FOLLOW ME?") and the VO gives the direct, plain-language
# answer -- the most literal, most pedagogical of the five, built for a
# viewer who wants the FAQ, not the story.
#
# SAME STANDING FACTS, same restrictions: software company, glasses
# sourced not designed here; recognition + anchoring is the capability;
# rental not ownership; Falls Park is a PROPOSED beta, not live; no
# invented raise/terms/traction/partnership/deployment date; generated
# imagery is a labelled VISUALIZATION, never evidence -- FIGURES is
# empty here too, so that banner never fires.
#
# FOOTAGE: every beat reuses an in-point explain1 (and in most cases
# explain3 too) already motion-verified clean -- this video introduces no
# new clips, only new durations (each a shorter SUBSET of an
# already-clean window, which stays clean) and an entirely new
# rhetorical frame around the same real material: IMG_6808 (open),
# IMG_6798 (intro), IMG_6806 (on/lock/anchor -- the one real continuous
# evidence take, same in-points as every version), IMG_6804 (rental),
# IMG_6790 (honest_stage), IMG_6803 (off), IMG_6797 (reach), IMG_6796
# (vision, explain1's corrected in-point). A fifth hero plate
# (IMG_HERO5, built at this video's own 4.0s) joins the other four
# without touching any of them.
W, H, FPS = 1920, 1080, 30
TOTAL = 56.0

# beat, clip, in-point, start, dur, note
BEATS = [
 ("open", "6808", 2.0, 0.0, 5.0,
  "wide valley/falls establishing shot -- same clip/in-point as explain1, shorter subset of the same clean window"),
 ("intro", "6798", 12.0, 5.0, 5.0,
  "wearer at the railing overlook -- same clip/in-point as explain1/explain3, same 5.0s duration explain3 already verified clean"),
 ("hero", "HERO5", 0.0, 10.0, 4.0,
  "the product itself -- built at 4.0s specifically for this video (raw/IMG_HERO5.MOV); does not touch v32c's IMG_HERO1.MOV, explain1's IMG_HERO2.MOV, explain2's IMG_HERO3.MOV or explain3's IMG_HERO4.MOV"),
 ("on",     "6806",  8.4, 14.0, 2.5, "switching it on -- same continuous take and exact in-point as every prior version"),
 ("lock",   "6806", 10.9, 16.5, 4.0, "recognises the falls -- take continues forward on its own clock, subset of explain1's verified window"),
 ("anchor", "6806", 15.4, 20.5, 5.0, "anchored to the place -- take continues from lock's own out-point, subset of explain1's verified window"),
 ("rental", "6804", 15.0, 25.5, 6.0,
  "wearer looking out over the falls, close profile -- same clip/in-point as explain1's corrected description, same 6.0s duration explain3 already verified clean"),
 ("honest_stage", "6790", 8.0, 31.5, 6.0,
  "wearer reading the overlook's own interpretive signage -- same clip/in-point as explain1/explain3, same 6.0s duration already verified clean"),
 ("off",  "6803",  2.5, 37.5, 3.5,
  "the AR overlay switched off -- the real place, nothing drawn on it (v32c's own phrasing for this beat: `off` names the INTERFACE being off, not the physical glasses). Same clip/in-point/duration as explain2/explain3, already verified clean"),
 ("reach", "6797", 40.0, 41.0, 4.0, "keeps walking, keeps working -- same clip/in-point/duration as explain2/explain3, already verified clean"),
 ("vision", "6796", 5.0, 45.0, 5.0,
  "wide shot, wearer walking toward the old mill-ruins wall -- same clip/in-point/duration as explain3, already verified clean"),
 ("end",   None,   0.0, 50.0, 6.0, "held from vision's last frame -- present day"),
]

WEARER_BEATS = set()
UI_OFF = {"open", "intro", "hero", "rental", "honest_stage", "off", "reach", "vision"}

# The literal structural device of this video: a question as nearly
# every beat's title, answered by that beat's VO. `hero` and `lock`
# carry no TITLES entry -- `hero`'s LABEL and `lock`'s recognition LABEL
# already occupy the frame, and `on`'s question ("WHAT DOES IT DO?")
# already covers the on/lock/anchor take as a single idea.
TITLES = {
 "open": ("WHAT IS THIS?", "FALLS PARK, SIOUX FALLS, SOUTH DAKOTA", 0.3),
 "intro": ("WHO MAKES IT?", "", 0.2),
 "on": ("WHAT DOES IT DO?", "", 0.15),
 "rental": ("WHO OWNS IT?", "", 0.2),
 "honest_stage": ("IS IT LIVE YET?", "", 0.2),
 "off": ("DO I NEED AN APP?", "", 0.15),
 "reach": ("DOES IT FOLLOW ME?", "", 0.15),
 "vision": ("WHERE ELSE COULD THIS GO?", "", 0.2),
}

FIGURES = {}

LABELS = {
 "hero": ((150, 900), "THE HARDWARE", "VISUALIZATION", 0.35, (0, 0)),
 "lock": ((880, 560), "THE FALLS", "BIG SIOUX RIVER", 0.9, (250, -330), 0.80),
}

ICE = {}
GEN_ICE = set()
CROP = {}

SCORE = {
 "start":   "open",
 "lift":    "on",
 "peak":    "lock",
 "release": "reach",
}


def figures(beat):
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
