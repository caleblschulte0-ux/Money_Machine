# DEMO 5 -- "THE TOUR". Lead capability: TWO PEOPLE, ONE PLACE, DIFFERENT
# CONTENT -- AND THEY CAN HAND EACH OTHER WHAT THEY FOUND.
#
# The obvious way to shoot this is a split screen, and it is the wrong way:
# a split says "here are two videos", not "here are two people standing next
# to each other seeing different things". So the frame is never divided. Both
# viewers' overlays live in the SAME image at the same time, told apart by
# colour and by a tag on every label -- A in cyan, B in amber. That is what a
# third person walking past would actually be able to describe.
#
# The multi-user half is the PIN: A marks something, the mark travels across
# the frame, and it arrives in B's colour with B's label. One object, two
# views, one hand-off.
#
# No invented claim anywhere. The labels name materials and structures that
# are in the shot; the profile names say what KIND of content a viewer has
# asked for, which is a product setting, not an assertion about the site.
W, H, FPS = 1920, 1080, 30
TOTAL = 33.5

BEATS = [
 ("open", "6805", 60.0,  0.0, 3.5, "the place, both of them in it. nothing on screen yet"),
 ("b1",   "6806", 15.0,  3.5, 7.5, "TWO PROFILES: A reads stone, B reads structure"),
 ("b2",   "6805", 20.0, 11.0, 7.0, "THE PIN: A marks it, it crosses, B receives it"),
 ("b3",   "6804", 15.0, 18.0, 8.5, "SAME ANCHOR, DIFFERENT DEPTH: one rock, two readings"),
 # b4 WAS 6807@6.0. The gate refused it at 4.5s: tail 3.97 px/frame against
 # a 0.95 middle -- the cut lands in the middle of a pan. The same plate is
 # clean over 7.5s because the move finishes and settles, which is exactly
 # why the tail has to be measured at the DURATION you are actually cutting.
 ("b4",   "6805", 44.0, 26.5, 4.5, "both viewers' marks standing in one frame"),
 ("end",   None,   0.0, 31.0, 2.5, "held from b4's last frame"),
]

# The two profiles. Colour is the whole legibility system here, so it is
# declared once and never varied.
PROFILES = {
 "A": dict(name="VIEWER A", track="STONE", col=(120, 226, 238)),   # cyan
 "B": dict(name="VIEWER B", track="STRUCTURE", col=(250, 206, 128)),  # amber
}

# beat: [(profile, anchor_xy, title, subtitle, appear_t, label_offset_xy)]
# Anchors placed by marking them on the plate and looking (out5/anchor5.jpg).
# Every one of these was moved after drawing it on the plate and looking at
# it (out5/anchor5.jpg). The first pass put "SIOUX QUARTZITE / SURFACE" on
# open water and "THE FALLS" on a lawn -- the system confidently naming the
# wrong thing, which is worse in a demo than naming nothing.
MARKS = {
 "b1": [("A", (400, 990),  "SIOUX QUARTZITE", "SURFACE",   1.2, (330, -260)),
        ("B", (250, 470),  "MILL HOUSE",      "STRUCTURE", 2.4, (300, -190))],
 "b2": [("A", (980, 570),  "THE FALLS",       "WATER",     1.0, (-520, -200))],
 "b3": [("A", (1250, 760), "QUARTZITE",       "SURFACE",   1.1, (-560, -250)),
        ("B", (1600, 470), "THE CROSSING",    "STRUCTURE", 2.6, (-620, -200))],
 # b4 re-lands A on the SAME object it pinned in b2, so the tour reads as
 # accumulating rather than as four unrelated labels.
 "b4": [("A", (1100, 575), "THE FALLS",       "WATER",     0.8, (-560, -200)),
        ("B", (420, 600),  "THE RUINS",       "STRUCTURE", 1.9, (300, -190))],
}

# beat: (from_xy, to_xy, t_start, seconds) -- the pin A drops and B receives.
# It travels on an arc rather than a straight line, because a straight line
# between two points in a photograph reads as a diagram and an arc reads as
# something being thrown.
HANDOFF = {
 "b2": ((980, 570), (430, 555), 3.1, 1.5),
}

# beat: (anchor_xy, title, subtitle, appear_t, offset_xy) -- the capability
# label, drawn in white so it belongs to neither viewer.
# The white capability label is anchored to real geometry too, never to empty
# sky. It is the film speaking rather than a third viewer, but if it floated
# free while everything else tracked, it would be the one element that gives
# the game away.
LABELS = {
 "b1": ((1560, 620), "TWO VIEWERS", "ONE PLACE",        4.0, (-620, -240)),
 "b2": ((700, 860),  "SHARED MARK", "A HANDS IT TO B",  5.4, (300, -170)),
 "b3": ((900, 900),  "SAME ANCHOR", "DIFFERENT DEPTH",  4.3, (330, -300)),
 "b4": ((860, 820),  "THE TOUR",    "TWO CONNECTED",    2.7, (330, -300)),
}


def timeline():
    t = 0.0
    for b in BEATS:
        assert abs(b[3] - t) < 1e-6, f"{b[0]} starts at {b[3]}, expected {t}"
        t += b[4]
    assert abs(t - TOTAL) < 1e-6, f"beats total {t}, expected {TOTAL}"
    return t
