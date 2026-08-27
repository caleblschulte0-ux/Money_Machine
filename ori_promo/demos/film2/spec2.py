# DEMO 2 -- "WHAT STOOD HERE". Lead capability: HISTORICAL RECONSTRUCTION.
# The glasses put back the thing that is gone, at the size and in the place it
# actually occupied, while you stand there.
#
# RENAMED from the brief's "ONE AFTERNOON". That title already belongs to a
# different, locked film, and reusing it would have two unrelated pieces of
# work answering to one name in the same handoff folder.
#
# THE HARD RULE THIS FILM LIVES UNDER. AR content is a VISUALISATION and never
# evidence. So: every reconstruction is rendered as luminous structure by
# ai/holo.py, which cannot be mistaken for a photograph; the tag VISUAL
# INTENTION ONLY is on screen for the whole of every beat that carries one;
# and no date, no measurement, no attribution and no claim of what any of it
# looked like is asserted anywhere in the film. The labels name the SITE and
# the ACT -- "QUEEN BEE MILL / RECONSTRUCTION" -- and nothing else.
#
# Plates are all NEW to this project: none of the five is used by Demo 1 or
# Demo 4, and all five pass shotqc with no TAIL, DRIFT or JOLT flag.
W, H, FPS = 1920, 1080, 30
TOTAL = 33.5

# beat, clip, in-point, start, dur, what the beat does
BEATS = [
 ("open", "6796", 30.0,  0.0, 3.5, "he stops at the marker. the system comes up. nothing claimed"),
 # b1 WAS 8.5s. The gate refused it: at 8.5 the camera is leaving the shot
 # (tail 2.93 px/frame against a 0.58 middle, ratio 5.0) -- the exact fault
 # the operator described, "it doesn't cut off in time and then you just get
 # panning away weirdly". At 7.0 it holds. The second went to b3, which is
 # the steadiest plate in the film (mid 0.11, drift 0.7% over 8.5s).
 ("b1",   "6806", 35.0,  3.5, 7.0, "THE MILL: scanned, then assembled above the falls"),
 ("b2",   "6806", 15.0, 10.5, 7.0, "THE MILL WORKS: a structure back on the left bank"),
 ("b3",   "6804", 15.0, 17.5, 8.5, "THE CROSSING: a bridge built back over the shelf"),
 ("b4",   "6796", 48.0, 26.0, 5.0, "back at the marker -- and now it is standing behind him"),
 ("end",   None,   0.0, 31.0, 2.5, "held from b4's last frame"),
]

# beat: (image key, centre_xy, height_px, appear_t, build_seconds)
# Centres and heights were set by drawing the rect on the plate and looking at
# it (out2/place.jpg). The reconstruction has to sit ON the ground it would
# have stood on; a building floating over a treeline is the single fastest way
# to make this read as a sticker.
PLACES = {
 "b1": [("A1", (560, 400), 460, 1.9, 2.2)],
 "b2": [("A2", (300, 540), 360, 1.4, 1.6)],
 "b3": [("A10", (1240, 640), 300, 1.5, 1.8)],
 "b4": [("A1", (470, 430), 430, 0.7, 1.2)],
}

# Which generated frame backs each reconstruction. Two seeds were made of
# every subject and the one that actually shows the subject was kept; the
# rejects are still in ai/gen so the choice can be argued with.
# SOURCE PROVENANCE — OPERATOR RULING 2026-08-27.
# r00 hard rule 1 and r08 both say "NO newly generated AI images". ChatGPT
# raised that against this film in r69 and it was RIGHT about the rule; both
# citations were verified before anything was decided. The operator resolved
# it: his 2026-08-26 instruction ("I need tk see ai images overlays... ask
# chatgpt for the images") SUPERSEDES the earlier written rule, and this film
# ships.
#
# These sources are therefore PROVISIONAL, not final. They stand in for the
# approved A1..A5 set until ORI_AI_HANDOFF is reachable. Swapping them is a
# one-line change here -- ai/holo.py treats any source image identically, so
# the edit, timing, treatment and labels are untouched by the swap.
PICK = {"A1": "A1_s11", "A9": "A9_s11", "A10": "A10_s11", "A3": "A3_s27",
        "A6": "A6_s11", "A2": "A2_s11", "A4": "A4_s27"}

# beat: (anchor_xy, title, subtitle, appear_t, label_offset_xy)
# NAMING IS PART OF THE HONESTY RULE. "QUEEN BEE MILL" is asserted once,
# because the interpretive marker in the opening shot says that name and the
# ruin is standing in frame. Everything else is named by what it IS -- the
# mill works, an earlier crossing -- and never by a specific building we
# cannot show stood in that exact spot. The film asserts no date anywhere.
LABELS = {
 "b1": ((560, 620),  "QUEEN BEE MILL", "RECONSTRUCTION", 2.6, (420, -300)),
 "b2": ((300, 730),  "THE MILL WORKS", "RECONSTRUCTION", 2.1, (420, -240)),
 "b3": ((1240, 830), "AN EARLIER CROSSING", "RECONSTRUCTION", 2.2, (-820, -300)),
 "b4": ((470, 660),  "IT STOOD HERE",  "RECONSTRUCTION", 1.6, (420, -250)),
}


def timeline():
    t = 0.0
    for b in BEATS:
        assert abs(b[3] - t) < 1e-6, f"{b[0]} starts at {b[3]}, expected {t}"
        t += b[4]
    assert abs(t - TOTAL) < 1e-6, f"beats total {t}, expected {TOTAL}"
    return t
