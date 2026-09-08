# ORI EXPLAINER #2 of 5 -- "FAST FACTS" (kinetic caption style)
#
# Same r145 mandate as explain1/spec_e1.py: five different STYLES of a
# full, self-contained explainer, all serving the identical purpose --
# someone with zero ORI context understands it top to bottom. v32c stays
# a 41s teaser, untouched. explain1 is calm documentary with long holds
# and full-sentence VO. THIS one is the opposite treatment of the SAME
# facts: quick cuts (2-4s per beat), a bold on-screen caption on almost
# every beat (TITLES, not just `open` the way explain1 uses it), and
# clipped, fragment VO instead of full sentences. 41.5s total, nearly
# half explain1's runtime, because "fast" is the whole premise.
#
# SAME STANDING FACTS, same restrictions: software company, glasses
# sourced not designed here; recognition + anchoring is the capability;
# rental not ownership; Falls Park is a PROPOSED beta, not live; no
# invented raise/terms/traction/partnership/deployment date; generated
# imagery is a labelled VISUALIZATION, never evidence -- FIGURES is
# empty here too, so that banner never fires.
#
# FOOTAGE: `on`/`lock`/`anchor` reuse IMG_6806 -- the one real continuous
# take that is actual evidence for the recognition+anchoring claim, same
# as every version of this project uses it, just re-timed shorter for
# this beat's faster pace (motion-checked fresh at the new windows:
# 8.4/2.0, 10.4/3.0, 13.4/4.0 -- all clean, no flags). Everything else is
# FRESH footage, not reused from explain1 or v32c, surveyed and
# motion-checked specifically for this file:
#   IMG_6687@24.0/4.0  -- wide falls + park + observation tower, confirmed
#                         static only in this window (the clip pans hard
#                         everywhere else checked: drift 15-40%+ at every
#                         other 2s step from 0 to 32)
#   IMG_6794@0.0        -- wearer at the railing, front-on, confirmed static
#   IMG_6799@0.0         -- wearer at the railing, turning toward camera,
#                          confirmed static
#   IMG_6807@0.0         -- wearer from behind at the railing, falls + city
#                          skyline visible, confirmed static (6807 pans hard
#                          after ~3s -- only the 0.0 in-point is clean)
#   IMG_6803@2.5/3.0, IMG_6797@40.0/3.5, IMG_6796@5.0/4.0 -- reused from
#   explain1 (same in-points, shorter durations here), already
#   motion-verified clean there; a shorter subset of a clean window stays
#   clean.
W, H, FPS = 1920, 1080, 30
TOTAL = 41.5

# beat, clip, in-point, start, dur, note
BEATS = [
 ("open", "6687", 24.0, 0.0, 3.0,
  "wide falls + park + observation tower -- confirmed static (shotqc: drift 15.2%, no flags) only at this in-point; the clip pans hard everywhere else"),
 ("intro", "6794", 0.0, 3.0, 3.0,
  "wearer at the railing, front-on, red shorts -- confirmed static (shotqc: drift 0.3%, no flags). Fresh angle, not explain1's IMG_6798"),
 ("hero", "HERO3", 0.0, 6.0, 3.0,
  "the product itself -- built at 3.0s specifically for THIS video's faster pace (raw/IMG_HERO3.MOV); does not touch v32c's IMG_HERO1.MOV (4.0s) or explain1's IMG_HERO2.MOV (6.0s)"),
 ("on",     "6806",  8.4,  9.0, 2.0, "switching it on -- same continuous take as explain1, re-timed shorter"),
 ("lock",   "6806", 10.4, 11.0, 3.0, "recognises the falls -- take continues forward on its own clock (8.4+2.0=10.4)"),
 ("anchor", "6806", 13.4, 14.0, 4.0, "anchored to the place -- take continues from lock's own out-point (10.4+3.0=13.4)"),
 ("rental", "6799", 0.0, 18.0, 3.5,
  "wearer at the railing turning toward camera -- confirmed static (shotqc: drift 1.0%, no flags). Fresh footage, not explain1's IMG_6804"),
 ("honest_stage", "6807", 0.0, 21.5, 3.5,
  "wearer from behind at the railing, falls + downtown skyline -- confirmed static (shotqc: drift 0.3%, no flags). Fresh footage, not explain1's IMG_6790"),
 ("off",  "6803",  2.5, 25.0, 3.0,
  "glasses off, wide view -- same clip/in-point as explain1 and v32c, shorter subset of the same clean window"),
 ("reach", "6797", 40.0, 28.0, 3.5, "keeps walking, keeps working -- same clip/in-point as explain1 and v32c, shorter subset"),
 ("vision", "6796", 5.0, 31.5, 4.0,
  "wide shot, wearer walking toward the old mill-ruins wall -- same clip/in-point as explain1's corrected vision beat, shorter subset of the same clean window"),
 ("end",   None,   0.0, 35.5, 6.0, "held from vision's last frame -- present day"),
]

WEARER_BEATS = set()
UI_OFF = {"open", "intro", "hero", "rental", "honest_stage", "off", "reach", "vision"}

# Captions on nearly every beat -- the visible difference from explain1,
# which only titles `open`. `on` and `reach` stay caption-free
# deliberately: at 2.0s and 3.5s respectively they are the two shortest
# beats after hero, and a caption that has to fade in and out inside 2.0s
# reads as a flicker, not a caption. Everything else gets one.
TITLES = {
 "open": ("FALLS PARK", "SIOUX FALLS, SOUTH DAKOTA", 0.2),
 "intro": ("SOFTWARE.", "NOT HARDWARE.", 0.15),
 "anchor": ("ANCHORED", "TO THE REAL PLACE AROUND YOU", 0.15),
 "rental": ("RENTED.", "NOT OWNED.", 0.15),
 "honest_stage": ("PROPOSED BETA.", "NOT LIVE YET.", 0.15),
 "off": ("NO PHONE.", "JUST LOOK.", 0.15),
 "vision": ("THE SAME PLATFORM.", "ANY REAL PLACE.", 0.15),
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
