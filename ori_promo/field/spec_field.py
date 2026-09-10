#!/usr/bin/env python3
"""v34 "THE FIELD GUIDE" -- spec. Second execution in the five-style
slate the operator ordered (r145__operator__five_style_variants.md,
transcribed 2026-09-08): five different creative EXECUTIONS of the same
single explainer purpose, not five different videos for five different
audiences. v33 ("What This Place Was") is the cinematic, emotional
execution and is FROZEN (r168's final review) -- do not touch it from
here. v34 is deliberately, structurally different: bright daylight,
diagram-led, numbered-step field-guide, per r168's exact direction
(r168__chatgpt__v34_field_guide_direction.md).

W, H = 1920, 1080. Full 16:9, NO 2.39 scope crop -- r168 was explicit
("16:9, 1920x1080") and the whole point of this style is that it does
NOT look like a cinema frame the way v33 does.

TOTAL = 70.0s (r168's target window was 65-75s).

FOOTAGE. Reuses this project's own raw/ library (never a second footage
set) but at IN-POINTS v33 never used, so this reads as a different edit
of the same real place, not a recut of the same shots:
  - IMG_6799 (falls+city overlook, unused anywhere in v33)
  - IMG_6790 (walking on the overlook platform, unused anywhere in v33)
  - IMG_6802 (a second overlook angle, unused anywhere in v33)
  - IMG_6806, in-point 33.0s -- v33 used 8.4-19.7s of this same 59.5s
    take; 33-45s is a DIFFERENT, verified-clean stretch (checked
    directly: the second visitor visible in v33's stretch and again at
    this clip's own t=22-30s is out of frame for the entire 33-45s
    window used here).
  - IMG_6805 (the wide plaza/path shot v33's `walk` also draws from,
    different in-point). Close beat uses in-point 19.0s specifically --
    the 10.0s in-point first tried had a jogger and a man walking a dog
    crossing the foreground, which then froze mid-stride under the brand
    card for its last 4s of hold. 19.0s is the same locked-off wide with
    the foreground clear.

GENERATED ASSETS REUSED, each carrying its own disclosure (never
regenerated -- same files, same standing rule that Claude never
generates images/video):
  - ai/hero/glasses_hero_chatgpt.jpg (product photo, "PRODUCT VISUALIZATION")
  - raw/IMG_WORN1.MOV (r163's worn-at-Falls-Park plate, already built for
    v33's `worn` beat, "PRODUCT VISUALIZATION")
  - raw/IMG_DAK1.MOV (the Dakota reconstruction plate, "VISUALIZATION")

ONE HONEST GAP: r168's "what visitors experience" section names three
examples -- historical reconstruction (have it, `dak`), spatial audio
(a diagram, not a photo -- built), and an ICE-AGE FALLS VISUALIZATION,
which this project does NOT have a usable asset for. `ai/ice/`'s old
pollinations renders exist but are a stylized fantasy canyon with no
falls and no visible tie to this location -- reusing them would be
presenting a worse, non-photoreal, non-location-matched image as if it
met the same bar dak/mam/worn/hardware already do, which is its own
kind of dishonesty. Per r168's own instruction ("use an exact
NEEDED_<asset> placeholder rather than fabricating evidence"), this
segment ships as an honest, on-brand placeholder card instead --
NEEDED_ICEAGE_FALLS_VISUALIZATION -- not a generated image standing in
for one that doesn't exist yet.
"""

W, H = 1920, 1080
FPS = 30
TOTAL = 70.0

RAW = "../raw"

# (name, start, dur, description)
BEATS = [
    ("open",        0.0,  6.0,  "place first -- wide falls+city overlook, title card"),
    ("system",      6.0,  9.0,  "hardware/software split screen"),
    ("borrow",     15.0,  8.0,  "borrow -> explore -> return step strip"),
    ("recognize",  23.0, 12.0,  "recognizes the zone, anchors to place"),
    ("experience", 35.0, 14.0,  "three examples: historical / ice-age / spatial audio"),
    ("destination",49.0, 11.0,  "site-based, reusable hardware, updateable software"),
    ("close",      60.0, 10.0,  "wide falls, brand card, final line"),
]

assert abs(sum(b[2] for b in BEATS) - TOTAL) < 1e-6

VO_LINES = [
    ("open", 0.4,
     "At Falls Park, the story is not trapped inside a screen. It is connected to the place around you."),
    ("system", 0.3,
     "Open Range Interactive is an AR experience built from two parts. "
     "The glasses are the hardware. What runs on them is the software."),
    ("borrow", 0.3,
     "You borrow the glasses at the site, put them on, and follow the route. "
     "There is no headset to buy and no personal device to keep."),
    ("recognize", 0.3,
     "At each experience zone, the system recognizes the location and anchors digital content "
     "to the real landscape. As you move, that content stays connected to the place."),
    ("experience", 0.3,
     "A historical figure can appear where the story happened. The falls can shift into an "
     "ice age visualization. Spatial audio can guide you through the scene and stay synchronized "
     "between visitors."),
    ("destination", 0.3,
     "When the route ends, the glasses are returned. The destination keeps the experience, "
     "updates the software, and adds new interpretation without adding permanent structures."),
    ("close", 0.4,
     "This is Open Range Interactive: place-based stories, seen where they belong."),
]
