# FILM C — "THE REQUIREMENTS", r56 commercial rebuild.
#
# r55: the argument survives, the picture does not. Real Falls Park footage
# carries the film; the systems language stays clear and subordinate. Every
# plate below is a NATIVE 1920x1080 landscape source at its own in-point --
# nothing is upscaled into the frame, and no rendered frame from Film A, B or
# D is reused.
#
# The six rules, their order, and their truth-status language are r32's and are
# AUTHORITATIVE. CONFIRMED BUILT appears nowhere in this film.
W, H, FPS = 1920, 1080, 30
TOTAL = 61.0

RULES = [
    ("01", "NO PHONE IN HAND",             "DESIGN REQUIREMENT"),
    ("02", "NO TRAIL INSTALLATION",        "DESIGN REQUIREMENT"),
    ("03", "OFFLINE SITE PACKAGE",         "PROTOTYPE TARGET"),
    ("04", "DESIGNATED SAFE VIEWING ZONE", "DESIGN REQUIREMENT"),
    ("05", "HISTORICALLY REVIEWED CONTENT","PROTOTYPE TARGET"),
    ("06", "SHARED EXPERIENCE",            "PROTOTYPE TARGET"),
]

# beat, source clip, in-point, start, duration, why this plate
BEATS = [
 ("open","6687",14.0,  0.0, 2.6, "the site, wide -- falls, rock shelf, people at distance"),
 ("r01", "6793", 1.0,  2.6, 7.0, "a visitor at the curved wall, arms at his sides, looking at "
                                 "the river. The rule is literal: nothing in his hands."),
 ("r02", "6805",44.0,  9.6, 7.0, "the paved path through open grass -- no posts, no cabinets, "
                                 "no mounted hardware anywhere along it"),
 ("r03", "6791",10.0, 16.6, 7.0, "the river shelf away from the street: the site as a place "
                                 "that has to work on its own"),
 ("r04", "6696", 6.0, 23.6, 8.0, "the falls at the left, a broad dry rock shelf at the right, "
                                 "and people standing ON the shelf -- the safe zone and the "
                                 "hazard are in the same frame, which is the whole rule"),
 ("r05", "6792",14.0, 31.6, 8.0, "the quarry ruins and the old structures across the water"),
 ("r06", "6808",14.0, 39.6, 8.0, "several people on the far bank and one crossing the lawn -- "
                                 "the place is already shared"),
 ("sys", "6682",14.0, 47.6, 8.8, "the main falls at full force: the payoff plate"),
 ("end", "6687",30.0, 56.4, 4.6, "back to the wide, quieter -- the mill house and the shelf"),
]

def timeline():
    t = 0.0
    for b in BEATS:
        assert abs(b[3] - t) < 1e-6, f"{b[0]} starts at {b[3]}, expected {t}"
        t += b[4]
    assert abs(t - TOTAL) < 1e-6, f"beats total {t}, expected {TOTAL}"
    return t
