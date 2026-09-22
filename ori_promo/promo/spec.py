"""ORI promo -- the cut.

52.1s, 1920x1080 composed for a 2.39:1 letterbox, 24fps. Music
"Inspired" (Kevin MacLeod, CC BY 4.0) at 120 BPM: a bar is 2.0s.

Story, second person -- a first-time viewer has to learn WHAT it is:
you've walked past this place; the story is on a sign nobody reads; so we
put it where you're looking -> it is a pair of glasses, the whole system,
nothing built into the park -> the map: every story preloaded, GPS, no
signal needed -> you're on the tower and it knows what you're looking at
-> the place transforms (ice, then the people who lived here) -> safety
at the water (audio only, then a warning, then off) -> your group hears
yours, the group walking past hears theirs -> any place -> end card.
"""

W, H, FPS = 1920, 1080, 24
BAR = 138                    # 2.39:1 letterbox: 1920 x 804 picture
TOTAL = 52.1
END_CARD_START = 49.3

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
    ("plaque",  "work/plaque_still.png",         0.0, 1.5, dict(still=True)),
    ("reading", f"{RAW}/IMG_6796.MOV",          31.0, 2.0, dict(move=("out", 0.03))),
    # the product: ONE reveal (operator 2026-09-22 killed the opening flash
    # and the punch-in on his face). The turntable carries both product
    # lines, pushes in on the sensor pod, and the next shot pulls out from
    # the temple on his face -- a match cut, studio to worn
    ("glasses", "../supplied/glasses_turntable.mp4", 0.8, 4.5, dict(stab=False, sdr=True, push=(0.78, 2.2, (1350, 470)))),
    ("worn",    f"{RAW}/IMG_6799.MOV",          10.2, 2.4, dict(mc=True, speed=0.85, pull=(0.4, 2.0, (480, 600)))),
    # the map (falls_map.py, real OSM geometry): the whole park -- every
    # story preloaded, GPS, no signal -- then a push in on YOU ARE HERE at
    # the viewing tower, and the cut lands on him standing on that tower
    ("map",     None,                            0.0, 5.5, dict(gen="map")),
    ("markers", f"{RAW}/IMG_6799.MOV",           2.0, 3.0, dict(mc=True, fx="markers", move=("in", 0.03))),
    ("mammoth", f"{RAW_MORE}/IMG_6806.MOV",     44.0, 5.0, dict(fx="mammoth", move=("in", 0.05))),
    ("dakota",  f"{RAW_MORE}/IMG_6804.MOV",     22.5, 3.0, dict(fx="dakota", move=("in", 0.04))),
    # safety, at the water: audio only near it, a warning too close, off
    # closer than that (operator 2026-09-22) -- the lens readout says so
    ("point",   f"{RAW}/IMG_6794.MOV",          44.0, 5.5, dict(fx="safety", move=("in", 0.03))),
    ("sync",    f"{RAW_MORE}/IMG_6808.MOV",     16.0, 5.0, dict(fx="sync", speed=0.9)),
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


# Word cards are RETIRED (operator 2026-09-22: "do we really need those
# anymore?"). With the narrator carrying the words they were subtitles of
# the narration, and they read as an editing-app overlay. The build still
# supports them ((t_in, t_out, lines[, corner])) -- the list is just empty.
CARDS = []

# Small documentary eyebrows, lower-left. (t_in, t_out, text)
EYEBROWS = [
    (1.6, 4.1, "OPEN RANGE  ·  AR GLASSES  ·  FALLS PARK, SIOUX FALLS, SD"),
]

# Small honesty tags, top-right, during generated imagery.
TAGS = [
    (9.9, 14.1, "PRODUCT VISUALIZATION"),
    (25.6, 29.9, "VISUALIZATION"),
    (30.4, 32.9, "VISUALIZATION"),
]

# Narration (Piper, offline, en_US-ryan-high). Timeline placement.
VO = [
    (1.6,  "You've walked past this a hundred times."),
    (4.5,  "The story's right here. Nobody reads the sign."),
    (7.9,  "So we put it where you're looking."),
    (9.9,  "A pair of glasses. That's the whole system."),
    (12.5, "No screens. No signs. Nothing built into the park."),
    (17.0, "Every story is already loaded. GPS knows where you're standing. No signal needed."),
    (22.6, "Look at something, and it knows what you're looking at."),
    (25.5, "Twelve thousand years ago, this was ice."),
    (30.3, "Then it was home."),
    (33.3, "Near the water, it goes audio only. Too close, it warns you. Closer than that, it shuts off."),
    (39.3, "Your group hears your story. The group walking past hears theirs."),
    (43.9, "Any place. Any story."),
    (49.3, "Open Range. See the story where you stand."),
]
# "kokoro:<voice>" = Kokoro (vo/kokoro/, 54 voices: af_heart, af_bella,
# am_michael, bm_george ...); a path = a Piper model. Placeholder until the
# real read; swap the voice here, nothing else changes.
VOICE = "kokoro:af_heart"
VOICE_SPEED = 0.95

MUSIC = "../music/inspired.mp3"
MUSIC_OFFSET = 0.93          # first downbeat in the file -> timeline 0.0
SFX = "/home/user/Shorts-pipeline/assets/sfx"
AMBIENCE = f"{RAW_MORE}/IMG_6682.MOV"     # the falls, under everything
# "ambience": the falls bed only. "ambience+vo": the bed, louder near the
# falls, with the narrator on top (operator 2026-09-22: "bring in the
# narrator ... the falls should be louder if we're near the falls").
# "score": ambience+vo with the score under it and a few placed effects
# (operator 2026-09-22: "it's just missing a little something").
# "full": the old designed mix, plus a separate VO variant.
AUDIO = "score"
# falls bed level per shot, dB: loud where the water is in frame or close
AMBIENCE_LEVELS = {"pan": -24, "falls": -14, "plaque": -30, "reading": -30, "glasscu": -30, "markers": -24,
                   "mammoth": -17, "dakota": -19, "point": -19, "glasses": -36, "tease": -40, "worn": -24, "map": -34, "point": -16, "sync": -27,
                   "bridge": -27, "close": -25, "logo": -60}

BRAND = "OPEN RANGE"
BRAND_SUB = "INTERACTIVE"
TAGLINE = "See the story where you stand."
# the payoff line under the tagline (ChatGPT review: "needs a stronger
# payoff than just branding"). Beta at Falls Park is the r00 brief's fact;
# swap for a URL or "coming soon" when there is one.
PAYOFF = "NOW IN BETA  ·  FALLS PARK, SIOUX FALLS"
