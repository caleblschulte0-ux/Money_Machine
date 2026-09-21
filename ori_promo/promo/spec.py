"""ORI promo -- the cut.

42.7s, 1920x1080 composed for a 2.39:1 letterbox, 24fps. Music
"Inspired" (Kevin MacLeod, CC BY 4.0) at 120 BPM: a bar is 2.0s.

Story, second person: you've walked past this place; the story is on a
sign nobody reads; so we put it where you're looking -> the glasses lock
on -> the place transforms (ice, then the people who lived here) ->
right where you stand -> the product -> walk past another group, you
only hear yours -> any place -> walk off -> end card.
"""

W, H, FPS = 1920, 1080, 24
BAR = 138                    # 2.39:1 letterbox: 1920 x 804 picture
TOTAL = 42.7
END_CARD_START = 39.9

RAW = "../raw"
RAW_MORE = "../raw_more"

# id, source, in-point (s), duration on the timeline (s), options
# speed: source seconds consumed per timeline second (0.7 = slow-mo)
# crop: (cx, cy, scale) punch-in on the prepared frame
# stab: ONLY for the handheld clips. Measured 2026-09-21 (LK flow, px/frame
# at 1920 wide): the tripod clips (6796, 6799, 6804, 6806, 6794, 6808, 6798)
# sit at 0.05-0.15 of shake; stabilising those made them wobble as vidstab
# chased the person in the foreground. Handheld: 6791 (pan), 6682 (pan),
# 6803 (move), 6709 (macro, 3.5) -- those get smoothing, or a still.
SHOTS = [
    ("logo",    None,                            0.0, 1.2, dict(black=True)),
    ("pan",     f"{RAW}/IMG_6791.MOV",           1.0, 3.0, dict(stab=True, smooth=90, zoom=6)),
    ("falls",   f"{RAW_MORE}/IMG_6682.MOV",     16.0, 2.0, dict(stab=True, smooth=90, zoom=6, speed=0.7, move=("in", 0.04))),
    # IMG_6709 is a PORTRAIT recording and handheld (p90 shake 3.5px/frame,
    # 30x the tripod shots); as video it was squashed to landscape and
    # shook. It is a text macro: one sharp frame with a slow push reads as
    # a locked-off macro and is steady by construction.
    ("plaque",  "work/plaque_still.png",         0.0, 2.5, dict(still=True)),
    ("reading", f"{RAW}/IMG_6796.MOV",          31.0, 2.0, dict(move=("out", 0.03))),
    ("glasscu", f"{RAW}/IMG_6796.MOV",          33.0, 2.5, dict(crop=(835, 299, 2.0), fx="activate")),
    ("markers", f"{RAW}/IMG_6799.MOV",           2.0, 3.0, dict(mc=True, fx="markers", move=("in", 0.03))),
    ("mammoth", f"{RAW_MORE}/IMG_6806.MOV",     44.0, 5.0, dict(fx="mammoth", move=("in", 0.05))),
    ("dakota",  f"{RAW_MORE}/IMG_6804.MOV",     22.5, 3.0, dict(fx="dakota", move=("in", 0.04))),
    ("point",   f"{RAW}/IMG_6794.MOV",          45.9, 2.0, dict(speed=0.7)),
    ("glasses", "../supplied/glasses_turntable.mp4", 0.8, 3.5, dict(stab=False, sdr=True)),
    ("sync",    f"{RAW_MORE}/IMG_6808.MOV",     16.0, 4.5, dict(fx="sync", speed=0.9)),
    ("bridge",  f"{RAW}/IMG_6798.MOV",          12.5, 3.0, dict(move=("in", 0.04))),
    ("close",   f"{RAW_MORE}/IMG_6803.MOV",      3.0, 5.5, dict(stab=True, smooth=90, zoom=8, speed=0.72, move=("in", 0.05))),
]

assert abs(sum(s[3] for s in SHOTS) - TOTAL) < 1e-6, sum(s[3] for s in SHOTS)


def shot_start(name):
    t = 0.0
    for sid, _, _, d, _ in SHOTS:
        if sid == name:
            return t
        t += d
    raise KeyError(name)


# Big statements, lower-left, one idea each. (t_in, t_out, lines)
CARDS = [
    (4.4,  6.1,  ["You've walked past this", "a hundred times."]),
    (6.5,  8.6,  ["The story's right here."]),
    (8.9,  10.6, ["Nobody reads the sign."]),
    (11.0, 13.1, ["So we put it where", "you're looking."]),
    (17.4, 20.9, ["Twelve thousand years ago,", "this was ice."]),
    (21.6, 24.0, ["Then it was home."]),
    (24.4, 26.0, ["Right where you're standing."]),
    (30.3, 33.9, ["Walk past another group.", "You only hear yours."]),
    (34.6, 36.9, ["Any place. Any story."]),
]

# Small documentary eyebrows, lower-left. (t_in, t_out, text)
EYEBROWS = [
    (1.6, 4.0, "FALLS PARK  ·  SIOUX FALLS, SD"),
]

# Small honesty tags, top-right, during generated imagery.
TAGS = [
    (16.7, 21.0, "VISUALIZATION"),
    (21.5, 24.0, "VISUALIZATION"),
    (26.4, 29.6, "PRODUCT VISUALIZATION"),
]

# Narration (Piper, offline, en_US-ryan-high). Timeline placement.
VO = [
    (4.4,  "You've walked past this a hundred times."),
    (6.5,  "The story's right here. Nobody reads the sign."),
    (11.0, "So we put it where you're looking."),
    (17.4, "Twelve thousand years ago, this was ice. Then it was home."),
    (24.4, "Right where you're standing."),
    (30.3, "Walk past another group. You only hear yours."),
    (34.6, "Any place. Any story."),
    (39.9, "Open Range. See the story where you stand."),
]
VOICE = "../vo/voices/en_US-ryan-high.onnx"

MUSIC = "../music/inspired.mp3"
MUSIC_OFFSET = 0.93          # first downbeat in the file -> timeline 0.0
SFX = "/home/user/Shorts-pipeline/assets/sfx"
AMBIENCE = f"{RAW_MORE}/IMG_6682.MOV"     # the falls, under everything
AUDIO = "ambience"           # "ambience": the falls bed only (no score, no VO -- not yet); "full": the designed mix + VO variant

BRAND = "OPEN RANGE"
BRAND_SUB = "INTERACTIVE"
TAGLINE = "See the story where you stand."
