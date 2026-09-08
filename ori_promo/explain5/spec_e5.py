# ORI EXPLAINER #5 of 5 -- "THE SILENT CUT" (caption-only, no narration)
#
# Last of the five r145 style variants. explain1 is calm documentary
# (full-sentence VO), explain2 is fast kinetic captions (fragment VO),
# explain3 is a cinematic trailer (rhetorical VO), explain4 is a literal
# Q&A (VO answers questions). THIS one is the one genuinely different
# axis none of the other four use: NO NARRATION AT ALL. Every beat
# carries its own on-screen caption (spec_e5.py's TITLES, present on
# every beat except `hero` and `lock`, which already carry their own
# LABEL) and the on-screen text alone has to say everything the VO said
# in every other version -- built for anyone watching muted (autoplay
# social feeds, sound off by default), which the other four videos all
# require audio to fully understand. The musical score bed
# (score_e5.py) still plays; there is simply no spoken narration over it.
#
# SAME STANDING FACTS, same restrictions: software company, glasses
# sourced not designed here; recognition + anchoring is the capability;
# rental not ownership; Falls Park is a PROPOSED beta, not live; no
# invented raise/terms/traction/partnership/deployment date; generated
# imagery is a labelled VISUALIZATION, never evidence -- FIGURES is
# empty here too, so that banner never fires.
#
# FOOTAGE: every in-point reuses a window already motion-verified clean
# somewhere else in this project (explain1's on/lock/anchor exact
# in-points at shorter subsets; explain2's IMG_6687/IMG_6794
# establishing/wearer windows at their exact already-verified durations;
# explain1/3's rental/honest_stage/off/reach/vision in-points at shorter
# subsets). No new clips, no new motion checks needed -- every window
# used here is a subset of, or identical to, a window this project has
# already checked clean.
W, H, FPS = 1920, 1080, 30
TOTAL = 46.5

# beat, clip, in-point, start, dur, note
BEATS = [
 ("open", "6687", 24.0, 0.0, 4.0,
  "wide falls + park + observation tower -- same clip/in-point/duration as explain2, already verified clean"),
 ("intro", "6794", 0.0, 4.0, 4.0,
  "wearer at the railing, front-on -- same clip/in-point/duration as explain2, already verified clean"),
 ("hero", "HERO6", 0.0, 8.0, 4.0,
  "the product itself -- built at 4.0s specifically for this video (raw/IMG_HERO6.MOV); does not touch v32c's IMG_HERO1.MOV or explain1-4's IMG_HERO2/3/4/5.MOV"),
 ("on",     "6806",  8.4, 12.0, 2.0, "switching it on -- same continuous take and exact in-point as every prior version, subset of explain1's verified window"),
 ("lock",   "6806", 10.9, 14.0, 3.5, "recognises the falls -- take continues forward on its own clock, subset of explain1's verified window"),
 ("anchor", "6806", 15.4, 17.5, 4.0, "anchored to the place -- take continues from lock's own out-point, subset of explain1's verified window"),
 ("rental", "6804", 15.0, 21.5, 4.0,
  "wearer looking out over the falls, close profile -- same clip/in-point as explain1's corrected description, shorter subset of the same clean window"),
 ("honest_stage", "6790", 8.0, 25.5, 4.5,
  "wearer reading the overlook's own interpretive signage -- same clip/in-point as explain1/3, shorter subset of the same clean window"),
 ("off",  "6803",  2.5, 30.0, 3.0,
  "the AR overlay switched off -- same clip/in-point/duration as explain3, already verified clean"),
 ("reach", "6797", 40.0, 33.0, 3.5, "keeps walking, keeps working -- same clip/in-point/duration as explain2/3, already verified clean"),
 ("vision", "6796", 5.0, 36.5, 4.0,
  "wide shot, wearer walking toward the old mill-ruins wall -- same clip/in-point/duration as explain3, already verified clean"),
 ("end",   None,   0.0, 40.5, 6.0, "held from vision's last frame -- present day"),
]

WEARER_BEATS = set()
UI_OFF = {"open", "intro", "hero", "rental", "honest_stage", "off", "reach", "vision"}

# EVERY beat except `hero`/`lock` (which already carry a LABEL) has a
# TITLES entry -- this is the whole point of the style: with no
# narration, the caption is the only channel carrying the explanation, so
# nothing can be left silent AND uncaptioned the way explain1-4 can
# afford to (they have VO to fall back on).
TITLES = {
 "open": ("FALLS PARK", "SIOUX FALLS, SOUTH DAKOTA", 0.2),
 "intro": ("OPEN RANGE INTERACTIVE", "A SOFTWARE COMPANY, NOT A HARDWARE MAKER", 0.15),
 "on": ("PUT THEM ON.", "", 0.1),
 "anchor": ("ANCHORED TO THE REAL PLACE.", "NOT A GENERIC APP.", 0.15),
 "rental": ("RENTED. NOT OWNED.", "DESTINATIONS LICENSE THE SOFTWARE.", 0.15),
 "honest_stage": ("A PROPOSAL. NOT LIVE YET.", "FALLS PARK IS THE PROPOSED FIRST BETA.", 0.15),
 "off": ("NO INTERFACE.", "JUST THE PLACE.", 0.15),
 "reach": ("KEEPS WORKING.", "WHEREVER YOU GO.", 0.15),
 "vision": ("ONE PLACE. THEN ANY PLACE.", "THE SAME PLATFORM, ANYWHERE.", 0.15),
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
