# ORI EXPLAINER #3 of 5 -- "THE LONG TAKE" (cinematic trailer style)
#
# Same r145 mandate as explain1/spec_e1.py and explain2/spec_e2.py: five
# different STYLES of a full, self-contained explainer, all serving the
# identical purpose -- someone with zero ORI context understands it top
# to bottom. v32c stays a 41s teaser, untouched. explain1 is calm
# documentary with full-sentence VO; explain2 is fast kinetic captions
# with fragment VO. THIS one sits between them in pace (60.5s) but is a
# different treatment again: short, rhetorical, trailer-cadence lines
# ("Nothing here is owned. Only ever rented, place to place.") instead of
# either full explanation or bare fragments, sparse on-screen text (two
# titles total, not one like explain1 or nearly-every-beat like
# explain2), and a wordless texture/breathing beat (`detail`) neither
# other video uses.
#
# SAME STANDING FACTS, same restrictions: software company, glasses
# sourced not designed here; recognition + anchoring is the capability;
# rental not ownership; Falls Park is a PROPOSED beta, not live; no
# invented raise/terms/traction/partnership/deployment date; generated
# imagery is a labelled VISUALIZATION, never evidence -- FIGURES is
# empty here too, so that banner never fires.
#
# FOOTAGE: `on`/`lock`/`anchor` reuse IMG_6806 at the EXACT SAME in-points
# and durations explain1 already motion-verified (8.4/2.5, 10.9/4.5,
# 15.4/6.0) -- the one real continuous take, actual evidence for the
# recognition+anchoring claim, every version of this project uses it
# unmodified. `rental` (IMG_6804@15.0), `honest_stage` (IMG_6790@8.0),
# `off` (IMG_6803@2.5), `reach` (IMG_6797@40.0), `vision` (IMG_6796@5.0)
# reuse explain1's already-verified clean in-points at shorter durations
# (a shorter subset of a clean window stays clean); `intro` reuses
# explain1's IMG_6798@12.0 at a fresh 5.0s duration, freshly motion-
# checked (drift 0.0%, no flags). Two beats are genuinely NEW footage,
# not used anywhere else in this project:
#   IMG_6805@24.0/5.0 -- a long (93.7s) static tripod shot from an
#     ELEVATED walkway, wearer at the railing, falls + downtown skyline
#     below. This is what an earlier survey note (spec_e1.py's original,
#     now-corrected draft) mistakenly described as IMG_6804 -- IMG_6804 is
#     actually a close ground-level profile (see explain1). IMG_6805 is
#     the real elevated-view clip; confirmed static at this in-point
#     (drift 0.0%, no flags) after scanning the whole clip in 6s steps.
#   IMG_6686@8.0/3.0 -- close texture of lichen-streaked Sioux quartzite
#     rock, confirmed static (drift 1.3%, no flags). Silent `detail` beat,
#     no VO, no title -- a breath, not an explanation.
W, H, FPS = 1920, 1080, 30
TOTAL = 60.5

# beat, clip, in-point, start, dur, note
BEATS = [
 ("open", "6805", 24.0, 0.0, 5.0,
  "elevated tripod shot, wearer at the railing, falls + downtown skyline below -- confirmed static (shotqc: drift 0.0%, no flags)"),
 ("detail", "6686", 8.0, 5.0, 3.0,
  "close texture, lichen on Sioux quartzite -- confirmed static (shotqc: drift 1.3%, no flags). Silent -- no VO, no title, a breath before `intro`"),
 ("intro", "6798", 12.0, 8.0, 5.0,
  "wearer at the railing overlook -- same clip/in-point as explain1, fresh 5.0s duration, confirmed static (shotqc: drift 0.0%, no flags)"),
 ("hero", "HERO4", 0.0, 13.0, 4.0,
  "the product itself -- built at 4.0s specifically for this video (raw/IMG_HERO4.MOV), touching neither v32c's IMG_HERO1.MOV (4.0s -- same duration, different file, never confused with v32c's frozen source) nor explain1's IMG_HERO2.MOV (6.0s) nor explain2's IMG_HERO3.MOV (3.0s)"),
 ("on",     "6806",  8.4, 17.0, 2.5, "switching it on -- same continuous take and exact in-point as explain1"),
 ("lock",   "6806", 10.9, 19.5, 4.5, "recognises the falls -- take continues forward on its own clock, same as explain1"),
 ("anchor", "6806", 15.4, 24.0, 6.0, "anchored to the place -- take continues from lock's own out-point, same as explain1"),
 ("rental", "6804", 15.0, 30.0, 6.0,
  "wearer looking out over the falls, close profile -- same clip/in-point as explain1's corrected description, shorter subset of the same clean window"),
 ("honest_stage", "6790", 8.0, 36.0, 6.0,
  "wearer reading the overlook's own interpretive signage -- same clip/in-point as explain1, shorter subset of the same clean window"),
 ("off",  "6803",  2.5, 42.0, 3.5,
  "glasses off, wide view -- same clip/in-point as explain1 and v32c, shorter subset of the same clean window"),
 ("reach", "6797", 40.0, 45.5, 4.0, "keeps walking, keeps working -- same clip/in-point as explain1 and v32c, shorter subset"),
 ("vision", "6796", 5.0, 49.5, 5.0,
  "wide shot, wearer walking toward the old mill-ruins wall -- same clip/in-point as explain1's corrected vision beat, shorter subset of the same clean window"),
 ("end",   None,   0.0, 54.5, 6.0, "held from vision's last frame -- present day"),
]

WEARER_BEATS = set()
UI_OFF = {"open", "detail", "intro", "hero", "rental", "honest_stage", "off", "reach", "vision"}

# Sparse on purpose -- the visible difference from explain2's near-every-
# beat captions. Two titles, both doing real rhetorical work; everything
# else is carried by the VO and the picture alone.
TITLES = {
 "open": ("FALLS PARK", "SIOUX FALLS, SOUTH DAKOTA", 0.4),
 "honest_stage": ("A PROPOSAL.", "NOT A FINISHED PRODUCT.", 0.3),
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
