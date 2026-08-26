# DEMO 1 — "THROUGH THE GLASS". Lead capability: LIVE RECOGNITION AND
# IN-PLACE LABELLING. The glasses know what you are looking at, and the label
# stays on it.
#
# Structure answers ChatGPT's r63 note directly: the product beat starts at
# 3.5s, not 22s or 45s, and every beat shows the CHAIN --
#   the wearer looks -> the system scans what is there -> a label anchors to it
#   and stays anchored while the camera moves.
#
# Every plate below passed shotqc with no TAIL / DRIFT / JOLT flag. The clips
# that carried Film C -- 6696, 6682, 6792, 6793 -- have ZERO clean windows
# between them and are not used here.
W, H, FPS = 1920, 1080, 30
TOTAL = 32.0

# beat, clip, in-point, start, dur, gate note
BEATS = [
 ("open","6805", 4.5,  0.0, 3.5, "mot 0.1 drift 0% -- the path, mill house upper left"),
 ("b1",  "6796", 8.5,  3.5, 7.0, "mot 0.2 drift 2% -- the ruin wall, dead steady"),
 ("b2",  "6798", 6.5, 10.5, 7.0, "mot 0.0 drift 0% -- he points at the skyline"),
 ("b3",  "6794",10.5, 17.5, 7.0, "mot 0.2 drift 1% -- the rapids from the curved wall"),
 ("b4",  "6791", 4.5, 24.5, 5.0, "mot 1.2 drift 7% -- the river shelf, wide"),
 ("end",  None,  0.0, 29.5, 2.5, "held from b4's last frame"),
]

# Labels name PLACES AND MATERIALS that are documented facts about this site --
# Queen Bee Mill, the Big Sioux River, Sioux quartzite, Sioux Falls. No dates,
# no distances, no measurements, nothing invented. The demo has to show
# RECOGNITION, and it can do that without asserting a single fact we cannot
# stand behind.
#
# beat: [(anchor_xy, title, subtitle, appear_t, side)]
# beat: [(anchor_xy, title, subtitle, appear_t, label_offset_xy)]
# Anchors verified by marking them on the plate and looking -- see
# anchorcheck.jpg. Every one sits ON its object, not in the sky above it,
# which is where the first pass put them.
ANCHORS = {
 "b1": [((600, 400),  "QUEEN BEE MILL",  "STRUCTURE / RUIN", 1.1, (330, -190))],
 "b2": [((1150, 430), "SIOUX FALLS",     "SKYLINE",          1.3, (-350, -180))],
 "b3": [((350, 870),  "BIG SIOUX RIVER", "WATER",            1.0, (250, -260)),
        ((1150, 900), "SIOUX QUARTZITE", "SURFACE",          2.8, (180, -190))],
 "b4": [((800, 760),  "SIOUX QUARTZITE", "SURFACE",          0.6, (240, -230))],
}
