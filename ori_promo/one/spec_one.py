# ORI — "WHAT THIS PLACE WAS". One film, replacing the five-demo set.
#
# OPERATOR RULING, 2026-08-27, which is why this file exists:
#   "all your videos suck. They have very good parts of them, like you're
#    anchoring things well. Why the hell is there not, like, an image of a
#    fucking... an old pioneer family beside the river? ... you just made it
#    a little fucking dot, not, like, make it a whole family."
#
# He is right, and the diagnosis is exact. The five films had good anchoring
# and nothing worth anchoring TO. Every generated image was run through
# holo.py and came out as cyan linework -- a wireframe outline of a mill
# does not show anyone what stood here. This film keeps the anchoring and
# puts real, full-scale, lit FIGURES on the real rock.
#
# THREE THINGS ARE REQUIREMENTS, named by the operator:
#   a pioneer family sitting on the modern-day rocks of Falls Park   -> b4
#   Falls Park as it looked in the ice age                           -> b5
#   Native Americans at the falls                                    -> b3
#
# WHAT WAS KEPT from the five, and from where:
#   the tracked reticle + label, on a real named thing               Demo 1
#   a reconstruction standing where the ruin still is                Demo 2
#   returning to the present as a deliberate release                 Demo 3
#   the footage gate: no plate is cut that the gate refuses          all
#
# EVERY PLATE IS GATED. b5 was first cut at 6791@18.0 for 10.0s and shotqc
# refused it -- tail 4.31 against a 0.83 middle, ratio 5.18, the camera
# leaving the shot exactly as the operator described it. Moved to 14.0.
W, H, FPS = 1920, 1080, 30
TOTAL = 57.0

# beat, clip, in-point, start, dur, what the beat does
BEATS = [
 ("open", "6790", 12.0,  0.0, 4.0, "at the rail. the system comes up, nothing claimed"),
 ("b1",   "6796", 48.0,  4.0, 7.0, "RECOGNISE: the Queen Bee Mill marker, a real sign the camera saw"),
 ("b2",   "6805", 60.0, 11.0, 8.0, "THE MILL: the building stands again above its own ruin"),
 ("b3",   "6804", 15.0, 19.0, 9.0, "BEFORE THE MILL: a Dakota family on the rock shelf"),
 ("b4",   "6791",  4.5, 28.0, 9.0, "THE SETTLERS: a family sitting on the quartzite, present-day rock"),
 ("b5",   "6791", 14.0, 37.0,10.0, "ICE: the same shelf under the last glaciation, and a mammoth"),
 ("b6",   "6794", 10.5, 47.0, 6.0, "RETURN: back to now, the falls as they are"),
 ("end",   None,   0.0, 53.0, 4.0, "held from b6's last frame"),
]

# beat: (image, foot_xy, height_px, appear_t, build_seconds, subj_depth, match)
# foot_xy is where the figure's FEET meet the ground, chosen by placing it
# and looking (era/_place2.png). height_px is set against the real people in
# the plates, not by eye -- an adult at that depth is that many pixels tall.
FIGURES = {
 # THE MILL. 300px read as a garden shed against a seven-storey claim, and
 # its base floated above the falls. 520px with the base dropped ONTO the
 # ruin line at y=505, and subj_depth 0.62 so the standing masonry and the
 # falls in front of it occlude the bottom edge -- a generated building has
 # a hard straight base, and the only thing that hides it is real geometry
 # crossing in front. match=0.22 because at the default 0.55 the light
 # match pulled seven storeys of stone green off the lawn behind it.
 "b2": [("ai/gen/A1_s11.jpg",      (985, 505), 520, 1.4, 2.0, 0.62, 0.22)],
 "b3": [("ai/era/dak_s17.jpg",     (1150, 745), 385, 1.5, 1.8, 0.55, 0.55)],
 # THE SETTLERS. This plate pans right-to-left by about 400px over the beat,
 # and a foot point that looks right on frame 1 rides the pan off the left
 # edge -- at 8.5s the family was half out of frame. Placed right of centre
 # so the pan carries it TOWARD the middle instead of out.
 "b4": [("ai/era/fam_s17.jpg",     (1220, 905), 450, 1.4, 1.8, 0.62, 0.55)],
 "b5": [("ai/era/mam_s17.jpg",     (1330, 835), 330, 2.6, 2.2, 0.55, 0.45)],
}

# beat: (anchor_xy, title, subtitle, appear_t, offset_xy)
LABELS = {
 "b1": ((1000, 300), "QUEEN BEE MILL",  "ON THIS SITE",      1.6, (-620, 200)),
 "b2": ((985, 420),  "THE MILL",        "RECONSTRUCTION",    3.0, (-620, 150)),
 "b3": ((1150, 745), "BEFORE THE MILL", "VISUALISATION",     3.0, (-620, -300)),
 "b4": ((1220, 905), "THE SETTLERS",    "VISUALISATION",     3.0, (-660, -430)),
 "b5": ((1330, 835), "THE LAST ICE",    "VISUALISATION",     4.0, (-680, -330)),
}

# The ice grade ramps in over b5 and is never applied anywhere else.
ICE = {"beat": "b5", "in": (0.2, 2.2)}


def timeline():
    t = 0.0
    for b in BEATS:
        assert abs(b[3] - t) < 1e-6, f"{b[0]} starts at {b[3]}, expected {t}"
        t += b[4]
    assert abs(t - TOTAL) < 1e-6, f"beats total {t}, expected {TOTAL}"
    return t
