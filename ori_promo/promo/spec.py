"""ORI promo -- the cut.

36.5s, 1920x1080, 30fps. Music "Inspired" (Kevin MacLeod, CC BY 4.0) at
120 BPM, so a bar is 2.0s and every cut sits on a bar or half-bar.

Structure: cold open on the place -> the plaque nobody reads -> the glasses
recognise the site (anchored markers) -> the world transforms (ice age,
tripod shot, wearer live in front) -> the mammoth stands on the real rocks
-> the Dakota family on the rock shelf -> his reaction -> borrow a pair ->
product -> tagline -> end card.
"""

W, H, FPS = 1920, 1080, 30
TOTAL = 36.5
END_CARD_START = 33.5

RAW = "../raw"
RAW_MORE = "../raw_more"

# id, source, in-point (s), duration on the timeline (s), options
# speed: source seconds consumed per timeline second (0.7 = slow-mo)
SHOTS = [
    ("open",    f"{RAW_MORE}/IMG_6676.MOV", 11.0, 2.5, dict(stab=True, move=("in", 0.05))),
    ("falls",   f"{RAW_MORE}/IMG_6682.MOV", 16.0, 2.0, dict(stab=True, speed=0.7, move=("in", 0.04))),
    ("plaque",  f"{RAW_MORE}/IMG_6709.MOV", 23.0, 2.5, dict(stab=True, move=("in", 0.06))),
    ("reading", f"{RAW}/IMG_6796.MOV",      31.0, 2.5, dict(stab=True, move=("out", 0.04))),
    ("markers", f"{RAW}/IMG_6799.MOV",       2.0, 3.0, dict(stab=True, fx="markers", move=("in", 0.03))),
    ("mammoth", f"{RAW_MORE}/IMG_6806.MOV", 43.0, 5.0, dict(stab=True, fx="mammoth", speed=0.85, move=("in", 0.05))),
    ("dakota",  f"{RAW_MORE}/IMG_6804.MOV", 12.0, 2.5, dict(stab=True, fx="dakota", move=("in", 0.04))),
    ("point",   f"{RAW}/IMG_6794.MOV",      45.9, 2.0, dict(stab=True, speed=0.7)),
    ("walk",    f"{RAW_MORE}/IMG_6805.MOV", 35.3, 2.5, dict(stab=True, move=("in", 0.05))),
    # product: the supplied studio turntable (SDR, 720p -> upscaled), front to 3/4
    ("glasses", "../supplied/glasses_turntable.mp4", 0.8, 3.5, dict(stab=False, sdr=True)),
    # walking past another group: each pair of glasses keeps its own audio bubble
    ("sync",    f"{RAW_MORE}/IMG_6808.MOV", 16.0, 4.5, dict(stab=True, fx="sync", speed=0.9)),
    ("close",   f"{RAW_MORE}/IMG_6803.MOV",  3.0, 4.0, dict(stab=True, move=("in", 0.05))),
]

assert abs(sum(s[3] for s in SHOTS) - TOTAL) < 1e-6, sum(s[3] for s in SHOTS)


def shot_start(name):
    t = 0.0
    for sid, _, _, d, _ in SHOTS:
        if sid == name:
            return t
        t += d
    raise KeyError(name)


# Big statements, lower-left. (t_in, t_out, lines)
CARDS = [
    (4.6,  6.9,  ["Every place has a story."]),
    (7.3,  9.4,  ["Most of it lives on a plaque."]),
    (10.0, 12.4, ["Open Range glasses put the story", "back where it happened."]),
    (14.1, 16.9, ["The ice that carved it."]),
    (17.8, 19.9, ["The people who stood here."]),
    (20.3, 21.9, ["Right in front of you."]),
    (22.4, 23.9, ["Borrow a pair at the park."]),
    (28.6, 31.9, ["Walk past another group.", "You only hear yours."]),
]

# Small documentary eyebrows, lower-left. (t_in, t_out, text)
EYEBROWS = [
    (0.8, 4.2, "FALLS PARK  ·  SIOUX FALLS, SD"),
]

# Small honesty tags, top-right, during generated imagery.
TAGS = [
    (12.9, 17.4, "VISUALIZATION"),
    (17.9, 19.9, "VISUALIZATION"),
    (24.5, 27.9, "PRODUCT VISUALIZATION"),
]

# Optional narration variant (Piper, offline). Timeline placement.
VO = [
    (4.6,  "Every place has a story. Most of it lives on a plaque."),
    (10.0, "Open Range glasses put the story back where it happened."),
    (14.1, "The ice that carved it. The people who stood here. Right in front of you."),
    (22.4, "Borrow a pair at the park."),
    (28.6, "Walk past another group. You only hear yours."),
]

MUSIC = "../music/inspired.mp3"
MUSIC_OFFSET = 0.93          # first downbeat in the file -> timeline 0.0
SFX = "/home/user/Shorts-pipeline/assets/sfx"

BRAND = "OPEN RANGE INTERACTIVE"
TAGLINE = "See the story where you stand."
