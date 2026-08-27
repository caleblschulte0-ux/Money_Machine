# DEMO 3 -- "THEN AND NOW". Lead capability: TIME, UNDER THE VIEWER'S CONTROL.
#
# The trap this film has to avoid is being Demo 2 again. Demo 2's capability is
# RECONSTRUCTION -- a thing that is gone, assembled where it stood. If this one
# also just fades a building in, the two demos demonstrate the same thing and,
# per the brief, one of them is wrong.
#
# So the star here is not the building. It is the SEAM: a vertical boundary
# that sweeps across the frame with the past on one side and the present on the
# other, and which the viewer drives. Demo 2 shows you what was here. This one
# hands you the dial. The proof that it is control and not playback is b2,
# where the seam is nudged back and forth and the world moves with it.
#
# NO DATES ANYWHERE. The time scale is labelled EARLIER and NOW, because we can
# stand behind an ordering and we cannot stand behind a year. Same rule as
# every other film: AR content is a visualisation, never evidence.
W, H, FPS = 1920, 1080, 30
TOTAL = 33.5

BEATS = [
 ("open", "6790", 12.0,  0.0, 3.5, "at the rail, reading the panel. the scale comes up"),
 ("b1",   "6806", 35.0,  3.5, 7.5, "the seam sweeps the mill site: past left, present right"),
 ("b2",   "6804", 15.0, 11.0, 7.0, "the viewer NUDGES it -- back, forward, back. control, not playback"),
 ("b3",   "6796", 48.0, 18.0, 8.5, "at the marker, the seam opens the other way"),
 ("b4",   "6805", 60.0, 26.5, 4.5, "released. the seam runs off the frame and it is now again"),
 ("end",   None,   0.0, 31.0, 2.5, "held from b4's last frame"),
]

# beat: (image key, centre_xy, height_px) -- what stands on the PAST side of
# the seam. Only visible where the seam has passed.
PAST = {
 "b1": ("A1",  (560, 400), 460),
 "b2": ("A10", (1240, 640), 300),
 "b3": ("A1",  (470, 430), 430),
 "b4": None,
}

PICK = {"A1": "A1_s11", "A2": "A2_s11", "A10": "A10_s11", "A9": "A9_s11"}

# beat: list of (t, seam_x_fraction). The seam is keyframed and interpolated
# with a smoothstep, so it accelerates and settles like something being
# dragged rather than something being animated.
#
# b2 is the whole argument of the film: the seam goes forward, stops, comes
# BACK past where it started, and goes forward again. Playback cannot do that.
SEAM = {
 "b1": [(0.0, -0.05), (1.2, -0.05), (5.6, 1.05), (7.5, 1.05)],
 "b2": [(0.0, 1.05), (1.0, 1.05), (2.6, 0.42), (3.4, 0.42),
        (4.3, 0.72), (5.1, 0.24), (5.9, 0.55), (7.0, 0.55)],
 "b3": [(0.0, 1.05), (1.3, 1.05), (5.4, -0.05), (8.5, -0.05)],
 "b4": [(0.0, 0.55), (1.4, 0.55), (3.6, 1.05), (4.5, 1.05)],
}

# beat: (anchor_xy, title, subtitle, appear_t, offset_xy)
LABELS = {
 # r72 CLAIMS PASS. Three of these four asserted something the film does not
 # show. "YOU DRIVE IT" and "LET GO" name a viewer-control MECHANISM -- a
 # hand, a controller, a gaze reticle -- and no frame in the beat contains
 # one, so a cold viewer is being told an interaction exists on the strength
 # of a caption. "IT STOOD HERE" asserts historical placement we have not
 # sourced, and it also pulled the film back toward Demo 2's territory when
 # the whole point of Demo 3 is temporal COMPARISON, not reconstruction.
 # The seam behaviour is unchanged; only the words are. What the film shows
 # is a boundary the viewer moves back and forth through, and that is now
 # exactly what the copy says.
 # "THE SAME VIEW" is KEPT: both sides of the seam are literally the same
 # photographed plate, so it is a statement about this film, not a claim
 # about verified registration in a product.
 "b1": ((560, 620),  "THEN AND NOW",     "THE SAME VIEW",    2.4, (420, -300)),
 "b2": ((1250, 760), "MOVE THROUGH TIME", "BACK AND FORWARD", 2.0, (-620, -280)),
 "b3": ((470, 660),  "COMPARE IN PLACE", "SAME GROUND",      2.6, (420, -260)),
 # offset pulled in from 330 to 180: "RETURN TO NOW" is 613px of title
 # against "LET GO"'s 216, and at the old offset the panel ended 51px from
 # the right edge of frame. Shorter leader, safer margin.
 "b4": ((900, 700),  "RETURN TO NOW",    "THE PRESENT VIEW", 1.2, (180, -260)),
}


def seam_x(beat, t):
    """Smoothstepped interpolation of the seam keyframes -> 0..1 of frame width."""
    ks = SEAM.get(beat)
    if not ks:
        return None
    if t <= ks[0][0]:
        return ks[0][1]
    for (t0, x0), (t1, x1) in zip(ks[:-1], ks[1:]):
        if t <= t1:
            u = (t - t0) / max(1e-6, t1 - t0)
            u = u * u * (3 - 2 * u)
            return x0 + (x1 - x0) * u
    return ks[-1][1]


def timeline():
    t = 0.0
    for b in BEATS:
        assert abs(b[3] - t) < 1e-6, f"{b[0]} starts at {b[3]}, expected {t}"
        t += b[4]
    assert abs(t - TOTAL) < 1e-6, f"beats total {t}, expected {TOTAL}"
    return t
