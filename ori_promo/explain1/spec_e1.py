# ORI EXPLAINER #1 of 5 -- "THE IDEA" (calm documentary style)
#
# Operator instruction, transcribed in the ORI_AI_HANDOFF mailbox as r145:
# five videos, none of them the old differentiated-use-case plan (investor
# teaser / social short / partner cut / kiosk loop). Five different STYLES,
# same single purpose: a YouTube video that gets someone with zero ORI
# context to understand what it is, top to bottom. v32c ("What This Place
# Was") is a 41s TEASER by design and stays exactly as it is; none of these
# five reuse its runtime, its cut, or its restraint about not fully
# explaining things. Each is a complete, independent explainer.
#
# THIS VIDEO'S STYLE: plain, calm, observational documentary -- the voice
# of someone walking you through it in order, no urgency, no fast cuts.
# Longer holds than v32c, VO that actually explains each idea instead of
# gesturing at it.
#
# SAME STANDING FACTS AS EVERY VERSION BEFORE THIS ONE, restated more fully
# because a full explainer has room to: software company, not a hardware
# maker (glasses sourced, not designed here); the capability is
# recognition + anchoring to the real place; the business model is rental,
# not ownership; Falls Park is the PROPOSED first beta, not a live
# deployment; no raise amount, no terms, no traction, no partnership, no
# deployment date invented; generated imagery is a labelled VISUALIZATION,
# never evidence -- currently FIGURES is empty, so that banner never
# fires, same as v32c.
#
# FOOTAGE: reuses the one real continuous take (IMG_6806, on/lock/anchor)
# because it is the one piece of real evidence this project has for the
# recognition+anchoring claim -- there is no other footage of the actual
# capability, so every one of the five videos needs it. Everything else
# here is B-roll NOT used in v32c, surveyed and motion-checked fresh for
# this file: IMG_6790 (wearer reading the overlook signage), IMG_6792
# (fast pan -- rejected, JOLT/DRIFT flagged at every window checked; using
# IMG_6808 instead, its confirmed-static predecessor-era replacement),
# IMG_6798 (wearer at the railing), IMG_6804 (wearer looking out over the
# falls, close profile), IMG_6796 (wide, wearer walking toward the
# mill-ruins wall).
#
# RAW/IMG_7032.MOV, IMG_7033.MOV, IMG_7039.MOV ARE NOT THIS PROJECT'S
# FOOTAGE. Checked while surveying unused clips for this video: all three
# are an unrelated screen recording of a hand on a laptop trackpad
# browsing a news site. Do not use them for any of the five videos.
W, H, FPS = 1920, 1080, 30
TOTAL = 71.0

# beat, clip, in-point, start, dur, note
BEATS = [
 ("open", "6808", 2.0, 0.0, 6.0,
  "wide valley/falls establishing shot -- confirmed static (shotqc: drift 0.5%, no flags)"),
 ("intro", "6798", 12.0, 6.0, 7.0,
  "wearer at the railing overlook -- confirmed static (shotqc: ratio 0.18, no flags)"),
 ("hero", "HERO2", 0.0, 13.0, 6.0,
  "the product itself -- built at 6.0s specifically for this video (raw/IMG_HERO2.MOV), NOT v32c's IMG_HERO1.MOV (4.0s, frozen, untouched)"),
 ("on",     "6806",  8.4, 19.0, 2.5, "switching it on -- same continuous take as v32c, same in-point"),
 ("lock",   "6806", 10.9, 21.5, 4.5, "recognises the falls -- same take, EXTENDED hold vs v32c's 3.8s: this video explains, not glances"),
 ("anchor", "6806", 15.4, 26.0, 6.0, "anchored to the place -- take continues from lock's own out-point (10.9+4.5=15.4), no repeat/skip"),
 ("rental", "6804", 15.0, 32.0, 8.0,
  "wearer looking out over the falls, close profile -- confirmed static (shotqc: ratio 0.72, no flags). VO explains the rental model explicitly, which v32c only implies in one line. CORRECTED NOTE: an earlier draft of this file called this an 'elevated wide walkway shot' -- that description was actually of a DIFFERENT clip glanced at during the same footage survey; this beat's own frames were re-checked directly and this note now describes what IMG_6804@15.0 actually shows"),
 ("honest_stage", "6790", 8.0, 40.0, 7.0,
  "wearer reading the overlook's own interpretive signage -- confirmed static (shotqc: ratio 0.99, no flags). VO states plainly that Falls Park is a PROPOSED beta, not a live rollout"),
 ("off",  "6803",  2.5, 47.0, 4.0,
  "glasses off, wide view -- same clip/in-point as v32c, duration capped at 4.0s per the standing footage-safety note (handheld drift past ~3.5-4.0s from this in-point)"),
 ("reach", "6797", 40.0, 51.0, 5.0, "keeps walking, keeps working -- same clip/in-point as v32c"),
 ("vision", "6796", 5.0, 56.0, 7.0,
  "wide shot, wearer walking a path toward the old mill-ruins wall -- confirmed static (shotqc: drift 2.6%, no flags). SWAPPED from an earlier draft that reused `rental`'s exact clip: caught on contact-sheet review that `rental` and `vision` were showing the identical static profile shot for two different explanatory ideas, killing visual variety across the video's back half. This clip is genuinely different footage, not a re-crop of the same moment -- the extensibility line, spoken instead of only read on the end card"),
 ("end",   None,   0.0, 63.0, 8.0, "held from vision's last frame -- present day"),
]

WEARER_BEATS = set()
UI_OFF = {"open", "intro", "hero", "rental", "honest_stage", "off", "reach", "vision"}

TITLES = {
 "open": ("FALLS PARK", "SIOUX FALLS, SOUTH DAKOTA", 0.6),
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
