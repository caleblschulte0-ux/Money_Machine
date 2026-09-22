#!/usr/bin/env python3
"""The `map` beat: a procedural map of Falls Park, from REAL geometry.

Every shape is OpenStreetMap data for the park (river polygon, both
waterfalls, the quartzite outcrops, lawns, trees, paths, steps, the Queen
Bee Mill ruins, the Overlook Cafe, the viewing tower, every plaque and
viewpoint) -- nothing is invented, nothing is a ribbon drawn by hand. The
operator's own reference for this beat was an aerial photo of the park
with a colour legend keyed to four kinds of place; that legend is the
overlay here:

    BLUE    visual scenes     (the falls, the mill, the Monarch statue)
    PURPLE  narration         (the plaques and information boards)
    AMBER   ambient sound     (the two waterfalls)
    GREEN   lookouts          (the mapped viewpoints and the tower)

and every marker sits on the real node that kind of place is mapped to.

Data: ``work/osm_map.xml`` is the OSM API bbox export (fetch() gets it,
ODbL -- "(c) OpenStreetMap contributors" goes in the end card credit);
``data/falls_park.json`` is the compact extraction committed so the build
is reproducible offline.

Rendering is PIL + OpenCV at 2x supersample, then a per-frame camera
(pull-out from the falls to the whole park) applied with one affine warp
for the base and the same matrix for every overlay point, so labels are
drawn at screen resolution and stay crisp.
"""
import json
import math
import os
import sys
import xml.etree.ElementTree as ET

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = "/home/user/Shorts-pipeline/assets/fonts"
DATA = f"{HERE}/data/falls_park.json"
OSM_XML = f"{HERE}/work/osm_map.xml"
BBOX = (-96.7262, 43.5530, -96.7168, 43.5610)      # lon_min, lat_min, lon_max, lat_max

W, H, FPS = 1920, 1080, 24
BAR = 138
SS = 2                                             # supersample for the base

# the frame is rotated so the river flows left -> right (it runs SSW->NNE)
LAT0, LON0 = 43.5574, -96.7226
THETA = math.atan2(276, 113)                       # bearing of the reach below the tower

# palette (RGB) -- the film's ground, ink and amber, plus the four zone hues
GROUND = (22, 24, 28)
LAWN = (40, 58, 46)
LAWN_EDGE = (52, 74, 58)
ROCK = (92, 66, 68)
WATER = (30, 86, 118)
WATER_DEEP = (22, 64, 92)
WATER_EDGE = (78, 150, 186)
PATH = (196, 186, 166)
ROAD = (70, 74, 80)
RAIL = (60, 62, 66)
BUILDING = (170, 166, 158)
BUILDING_SIDE = (96, 92, 86)
HISTORIC = (206, 178, 132)
TREE = (34, 70, 46)
TREE_HI = (60, 104, 70)
INK = (245, 243, 238)
SUBTLE = (160, 158, 152)
AMBER = (255, 190, 90)

ZONES = {  # kind: (label, colour)
    "visual": ("VISUAL SCENES", (96, 176, 255)),
    "narration": ("NARRATION", (178, 142, 255)),
    "ambient": ("AMBIENT SOUND", AMBER),
    "lookout": ("LOOKOUTS", (112, 224, 160)),
}


def font(weight, size):
    return ImageFont.truetype(f"{FONTS}/{'InterDisplay-Bold' if weight == 'Display' else 'Inter-' + weight}.ttf", size)


# --------------------------------------------------------------------------- data

def fetch():
    import urllib.request
    url = "https://api.openstreetmap.org/api/0.6/map?bbox={},{},{},{}".format(*BBOX)
    os.makedirs(os.path.dirname(OSM_XML), exist_ok=True)
    urllib.request.urlretrieve(url, OSM_XML)


def to_xy(lat, lon):
    """Metres east/south of the origin, then rotated so the river runs
    left -> right. y grows DOWN (screen convention)."""
    x = (lon - LON0) * math.cos(math.radians(LAT0)) * 111320.0
    y = -(lat - LAT0) * 110574.0
    c, s = math.cos(THETA), math.sin(THETA)
    return (x * c - y * s, x * s + y * c)


def _chain(rings_ways):
    """Join OSM ways sharing endpoints into closed rings."""
    ways = [list(w) for w in rings_ways if len(w) >= 2]
    rings = []
    while ways:
        cur = ways.pop(0)
        changed = True
        while changed and cur[0] != cur[-1]:
            changed = False
            for i, w in enumerate(ways):
                if w[0] == cur[-1]:
                    cur += w[1:]; ways.pop(i); changed = True; break
                if w[-1] == cur[-1]:
                    cur += w[::-1][1:]; ways.pop(i); changed = True; break
                if w[-1] == cur[0]:
                    cur = w[:-1] + cur; ways.pop(i); changed = True; break
                if w[0] == cur[0]:
                    cur = w[::-1][:-1] + cur; ways.pop(i); changed = True; break
        rings.append(cur)
    return rings


def extract(xml_path=OSM_XML, out=DATA):
    root = ET.parse(xml_path).getroot()
    nodes = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in root.findall("node")}
    ways = {}
    for w in root.findall("way"):
        tags = {t.get("k"): t.get("v") for t in w.findall("tag")}
        nds = [nodes[nd.get("ref")] for nd in w.findall("nd") if nd.get("ref") in nodes]
        ways[w.get("id")] = (tags, nds)
    F = {"water": [], "water_holes": [], "park": [], "rock": [], "lawn": [], "paths": [], "steps": [], "roads": [],
         "rail": [], "buildings": [], "historic": [], "trees": [], "points": [], "weir": [], "labels": []}
    for r in root.findall("relation"):
        tags = {t.get("k"): t.get("v") for t in r.findall("tag")}
        outer = [ways[m.get("ref")][1] for m in r.findall("member") if m.get("type") == "way" and m.get("role") == "outer" and m.get("ref") in ways]
        inner = [ways[m.get("ref")][1] for m in r.findall("member") if m.get("type") == "way" and m.get("role") == "inner" and m.get("ref") in ways]
        if tags.get("natural") == "water":
            F["water"] += _chain(outer); F["water_holes"] += _chain(inner)
        elif tags.get("leisure") == "park":
            F["park"] += _chain(outer)
    for wid, (tags, nds) in ways.items():
        if len(nds) < 2:
            continue
        hw = tags.get("highway")
        if tags.get("natural") == "water" and nds[0] == nds[-1]:
            F["water"].append(nds)
        elif tags.get("natural") == "bare_rock":
            F["rock"].append(nds)
        elif tags.get("landuse") == "grass" or tags.get("leisure") in ("park", "garden"):
            F["lawn"].append(nds)
        elif hw == "steps":
            F["steps"].append(nds)
        elif hw in ("footway", "path", "pedestrian", "cycleway"):
            F["paths"].append(nds)
        elif hw in ("service", "residential", "tertiary", "unclassified", "secondary", "primary"):
            F["roads"].append(nds)
        elif tags.get("railway") == "rail":
            F["rail"].append(nds)
        elif tags.get("waterway") == "weir":
            F["weir"].append(nds)
        elif "building" in tags:
            (F["historic"] if tags.get("historic") or tags.get("man_made") == "tower" else F["buildings"]).append(nds)
            if tags.get("name") in ("Falls Park Viewing Tower", "Falls Overlook Cafe", "Queen Bee Turbine"):
                lat = sum(p[0] for p in nds) / len(nds); lon = sum(p[1] for p in nds) / len(nds)
                F["labels"].append({"name": {"Falls Park Viewing Tower": "VIEWING TOWER", "Falls Overlook Cafe": "OVERLOOK CAFE",
                                             "Queen Bee Turbine": "QUEEN BEE MILL"}[tags["name"]], "ll": (lat, lon)})
                if tags["name"] == "Queen Bee Turbine":
                    F["points"].append({"kind": "visual", "ll": (lat, lon), "name": "Queen Bee Mill"})
                if tags["name"] == "Falls Park Viewing Tower":
                    F["points"].append({"kind": "lookout", "ll": (lat, lon), "name": "Viewing Tower"})
    for n in root.findall("node"):
        tags = {t.get("k"): t.get("v") for t in n.findall("tag")}
        if not tags:
            continue
        ll = nodes[n.get("id")]
        if tags.get("natural") == "tree":
            F["trees"].append(ll)
        elif tags.get("waterway") == "waterfall":
            F["points"].append({"kind": "ambient", "ll": ll, "name": tags.get("name")})
            F["points"].append({"kind": "visual", "ll": ll, "name": tags.get("name")})
            if tags.get("name") == "Middle Sioux Falls":
                F["labels"].append({"name": "BIG SIOUX FALLS", "ll": ll})
        elif tags.get("tourism") == "viewpoint":
            F["points"].append({"kind": "lookout", "ll": ll})
        elif tags.get("memorial") == "plaque" or tags.get("information") == "board":
            F["points"].append({"kind": "narration", "ll": ll})
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        json.dump(F, f, separators=(",", ":"))
    return F


def load():
    if not os.path.exists(DATA):
        if not os.path.exists(OSM_XML):
            fetch()
        extract()
    with open(DATA) as f:
        return json.load(f)


# --------------------------------------------------------------------------- base map

class View:
    """Map metres -> base-canvas pixels."""
    def __init__(self, ppm, cw, ch, cx=0.0, cy=0.0):
        self.ppm, self.cw, self.ch, self.cx, self.cy = ppm, cw, ch, cx, cy

    def px(self, ll):
        x, y = to_xy(*ll)
        return ((x - self.cx) * self.ppm + self.cw / 2, (y - self.cy) * self.ppm + self.ch / 2)

    def poly(self, pts):
        return np.array([self.px(p) for p in pts], np.float32)


def _glow(img, cx, cy, r, color, amount):
    """Additive soft disc."""
    x0, x1 = max(0, int(cx - r * 3)), min(img.shape[1], int(cx + r * 3) + 1)
    y0, y1 = max(0, int(cy - r * 3)), min(img.shape[0], int(cy + r * 3) + 1)
    if x1 <= x0 or y1 <= y0:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    g = np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r)) * amount
    reg = img[y0:y1, x0:x1].astype(np.float32)
    img[y0:y1, x0:x1] = np.clip(reg + g[:, :, None] * np.array(color[::-1], np.float32), 0, 255).astype(np.uint8)



def _fill(img, polys, color, aa=True):
    if not polys:
        return
    cv2.fillPoly(img, [np.round(p).astype(np.int32) for p in polys], color[::-1], lineType=cv2.LINE_AA if aa else cv2.LINE_8)


def _lines(img, polys, color, w, closed=False):
    for p in polys:
        cv2.polylines(img, [np.round(p).astype(np.int32)], closed, color[::-1], max(1, int(round(w))), cv2.LINE_AA)


def _soft_light(img, mask, color, amount):
    """Add colour where mask (float 0..1) says, softly."""
    m = mask[:, :, None] * amount
    img[:] = np.clip(img.astype(np.float32) * (1 - m) + np.array(color[::-1], np.float32) * m, 0, 255).astype(np.uint8)


def build_base(F, ppm, cw, ch, cx, cy):
    """The static map at (cw, ch) pixels, `ppm` pixels per metre."""
    V = View(ppm, cw, ch, cx, cy)
    img = np.zeros((ch, cw, 3), np.uint8)
    img[:] = GROUND[::-1]
    # a faint warm grain so the ground is not a flat fill
    rng = np.random.default_rng(7)
    grain = cv2.GaussianBlur(rng.normal(0, 1, (ch, cw)).astype(np.float32), (0, 0), 1.2)
    img[:] = np.clip(img.astype(np.float32) + grain[:, :, None] * 5, 0, 255).astype(np.uint8)
    # park lawn: the park polygon, then explicit grass
    _fill(img, [V.poly(p) for p in F["park"]], LAWN)
    _lines(img, [V.poly(p) for p in F["park"]], LAWN_EDGE, ppm * 0.9, closed=True)
    _fill(img, [V.poly(p) for p in F["lawn"]], LAWN)
    # quartzite outcrops
    _fill(img, [V.poly(p) for p in F["rock"]], ROCK)
    # water: a deep fill, a lighter shore line, an inner glow
    water = np.zeros((ch, cw), np.uint8)
    cv2.fillPoly(water, [np.round(V.poly(p)).astype(np.int32) for p in F["water"]], 255, cv2.LINE_AA)
    cv2.fillPoly(water, [np.round(V.poly(p)).astype(np.int32) for p in F["water_holes"]], 0, cv2.LINE_AA)
    wm = water.astype(np.float32) / 255
    _soft_light(img, wm, WATER, 1.0)
    dist = cv2.distanceTransform((water > 127).astype(np.uint8), cv2.DIST_L2, 5)
    edge = np.clip(1 - dist / (ppm * 4.0), 0, 1) * wm
    _soft_light(img, edge, WATER_EDGE, 0.55)
    deep = np.clip((dist - ppm * 6) / (ppm * 10), 0, 1)
    _soft_light(img, deep, WATER_DEEP, 0.6)
    # rapids: scattered white-water strokes on the water around each fall,
    # denser at the drop, plus a soft mist glow there
    rr = np.random.default_rng(3)
    for pt in F["points"]:
        if pt["kind"] != "ambient":
            continue
        main = pt.get("name") == "Middle Sioux Falls"     # the falls everyone means; the upper drop gets a whisper
        x, y = V.px(pt["ll"])
        _glow(img, x, y, ppm * (9 if main else 4), (225, 236, 244), 0.35 if main else 0.15)
        for _ in range(70 if main else 14):
            r = abs(rr.normal(0, ppm * 9)); a = rr.uniform(0, 2 * math.pi)
            xx, yy = x + r * math.cos(a), y + r * math.sin(a)
            if not (0 <= xx < cw and 0 <= yy < ch) or water[int(yy), int(xx)] < 127:
                continue
            ln = ppm * rr.uniform(0.8, 2.4); ang = rr.normal(0, 0.25)
            dx, dy = math.cos(ang) * ln, math.sin(ang) * ln
            cv2.line(img, (int(xx - dx), int(yy - dy)), (int(xx + dx), int(yy + dy)),
                     (226, 234, 240), max(1, int(ppm * 0.45)), cv2.LINE_AA)
    _lines(img, [V.poly(p) for p in F["weir"]], (220, 226, 232), ppm * 0.7)
    # rail, roads, paths, steps
    for p in F["rail"]:
        q = np.round(V.poly(p)).astype(np.int32)
        cv2.polylines(img, [q], False, RAIL[::-1], max(1, int(ppm * 0.9)), cv2.LINE_AA)
    _lines(img, [V.poly(p) for p in F["roads"]], ROAD, ppm * 3.2)
    _lines(img, [V.poly(p) for p in F["roads"]], (88, 92, 98), ppm * 0.6)
    _lines(img, [V.poly(p) for p in F["paths"]], (0, 0, 0), ppm * 1.4)          # a dark keyline under the paths
    _lines(img, [V.poly(p) for p in F["paths"]], tuple(int(c * 0.8) for c in PATH), ppm * 0.8)
    for p in F["steps"]:
        q = V.poly(p)
        for i in range(len(q) - 1):
            a, b = q[i], q[i + 1]
            n = max(2, int(np.hypot(*(b - a)) / (ppm * 1.1)))
            d = (b - a) / n
            nrm = np.array([-d[1], d[0]]); nrm = nrm / (np.linalg.norm(nrm) + 1e-6) * ppm * 1.1
            for k in range(n + 1):
                c = a + d * k
                cv2.line(img, tuple(np.round(c - nrm).astype(int)), tuple(np.round(c + nrm).astype(int)), PATH[::-1], max(1, int(ppm * 0.45)), cv2.LINE_AA)
    # buildings: a 2.5D extrusion (side first, then the lit roof)
    for polys, roof in ((F["buildings"], BUILDING), (F["historic"], HISTORIC)):
        side = tuple(int(c * 0.55) for c in roof)
        for p in polys:
            q = V.poly(p)
            h = ppm * 2.6
            for dz in np.linspace(h, 0, max(2, int(h))):
                _fill(img, [q + np.array([0, dz], np.float32)], side)
            _fill(img, [q], roof)
            _lines(img, [q], tuple(min(255, int(c * 1.15)) for c in roof), max(1, ppm * 0.35), closed=True)
    # READABILITY (operator 2026-09-22: "hard to understand at a glance"):
    # no tree dots, and everything that is not the park or the river --
    # streets, rail, the neighbourhood -- sinks most of the way into the
    # ground, so the eye has three things to read: water, park, places.
    keep = np.zeros((ch, cw), np.uint8)
    cv2.fillPoly(keep, [np.round(V.poly(p)).astype(np.int32) for p in F["park"]], 255, cv2.LINE_AA)
    keep = cv2.dilate(keep, np.ones((int(ppm * 14) | 1,) * 2, np.uint8))
    keep = np.maximum(keep, water)
    keep = cv2.GaussianBlur(keep, (0, 0), ppm * 6).astype(np.float32) / 255
    k = 0.18 + 0.82 * keep
    img[:] = (img.astype(np.float32) * k[:, :, None] + np.array(GROUND[::-1], np.float32) * (1 - k)[:, :, None]).astype(np.uint8)
    return img, V, water


# --------------------------------------------------------------------------- overlay + camera

def ease(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def ease_out(u):
    u = min(1.0, max(0.0, u))
    return 1 - (1 - u) ** 3


def _text(draw, xy, s, fnt, fill, anchor="la", tracking=0.0):
    """Letter-spaced text. Measured first, so a right or centre anchor
    positions the WHOLE string, then drawn glyph by glyph left to right."""
    if not tracking:
        draw.text(xy, s, font=fnt, fill=fill, anchor=anchor)
        return
    widths = [draw.textlength(ch, font=fnt) for ch in s]
    total = sum(widths) + tracking * (len(s) - 1)
    x, y = xy
    if anchor[0] == "r":
        x -= total
    elif anchor[0] == "m":
        x -= total / 2
    va = "l" + anchor[1]
    for ch, w in zip(s, widths):
        draw.text((x, y), ch, font=fnt, fill=fill, anchor=va)
        x += w + tracking


def cluster(points, radius_m=42.0):
    """Merge markers of one kind closer than radius_m -- six plaques in a
    row read as noise; one marker reads as a place."""
    out = []
    for pt in points:
        x, y = to_xy(*pt["ll"])
        for c in out:
            if c["kind"] == pt["kind"] and math.hypot(c["x"] - x, c["y"] - y) < radius_m:
                c["n"] += 1
                c["x"] = (c["x"] * (c["n"] - 1) + x) / c["n"]; c["y"] = (c["y"] * (c["n"] - 1) + y) / c["n"]
                break
        else:
            out.append({"kind": pt["kind"], "x": x, "y": y, "n": 1, "name": pt.get("name")})
    return out


def render(out_mp4, dur=5.0, preview_frames=None):
    """Write the beat. Camera: the whole park while the four kinds of
    place bloom on in turn, then a push IN on the viewing tower -- YOU ARE
    HERE -- so the cut lands on the wearer standing on that tower."""
    F = load()
    ppm_wide = 3.25                     # px/m on the wide frame (1920 px ~ 590 m)
    cx, cy = 10.0, 12.0                 # metres: falls cluster centre-left, tower upper right
    margin = 1.35
    cw, ch = int(W * SS * margin), int(H * SS * margin)
    base, V, water = build_base(F, ppm_wide * SS, cw, ch, cx, cy)
    # every marker is a place to STAND (operator 2026-09-22: "you can't
    # walk on water"): a marker inside the river moves to the nearest bank
    land = (water < 127).astype(np.uint8)
    dist, lbl = cv2.distanceTransformWithLabels(1 - land, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    land_idx = np.flatnonzero(land.ravel())
    ys, xs = np.divmod(land_idx, cw)
    label_xy = {}
    for yy, xx in zip(ys, xs):
        label_xy.setdefault(int(lbl[yy, xx]), (int(xx), int(yy)))
    n = int(round(dur * FPS))
    f_title, f_sub = font("SemiBold", 40), font("Medium", 22)
    f_label, f_leg = font("Medium", 21), font("Medium", 24)
    f_you = font("SemiBold", 26)
    order = ["ambient", "visual", "narration", "lookout"]
    t_zone = {k: 0.5 + i * 0.38 for i, k in enumerate(order)}
    marks = cluster(F["points"])
    for mk in marks:
        px_, py_ = int((mk["x"] - cx) * ppm_wide * SS + cw / 2), int((mk["y"] - cy) * ppm_wide * SS + ch / 2)
        if 0 <= px_ < cw and 0 <= py_ < ch and water[py_, px_] >= 127:
            nx, ny = label_xy[int(lbl[py_, px_])]
            # step a few metres further onto the bank so the pin is clearly on land
            vx, vy = nx - px_, ny - py_; L = math.hypot(vx, vy) or 1.0
            nx += vx / L * ppm_wide * SS * 6; ny += vy / L * ppm_wide * SS * 6
            mk["x"] = (nx - cw / 2) / (ppm_wide * SS) + cx; mk["y"] = (ny - ch / 2) / (ppm_wide * SS) + cy
    tower = next(l for l in F["labels"] if l["name"] == "VIEWING TOWER")
    txm, tym = V.px(tower["ll"])
    T_PUSH0, T_PUSH1 = 3.3, 4.85        # the push-in on the tower (the wide map holds ~3.3s)
    frames = []
    which = range(n) if preview_frames is None else preview_frames
    for i in which:
        t = i / FPS
        # camera: wide, a slow creep, then the push in on the tower
        u = ease((t - T_PUSH0) / (T_PUSH1 - T_PUSH0))
        z = (1.0 + 0.03 * ease(t / T_PUSH0)) * (1 - u) + 2.4 * u
        px = cw / 2 + (txm - cw / 2) * u
        py = ch / 2 + (tym - ch / 2) * u
        s_ = z / SS
        M = cv2.getRotationMatrix2D((px, py), 0.0, s_)
        M[0, 2] += W / 2 - px; M[1, 2] += H / 2 - py
        img = cv2.warpAffine(base, M, (W, H), flags=cv2.INTER_AREA if s_ < 1 else cv2.INTER_LINEAR, borderValue=GROUND[::-1])

        def scr(x, y):
            return (M[0, 0] * x + M[0, 1] * y + M[0, 2], M[1, 0] * x + M[1, 1] * y + M[1, 2])

        def scr_ll(ll):
            return scr(*V.px(ll))

        fade_wide = 1 - 0.92 * u         # the wide-frame overlays leave as the camera commits to the tower
        # place markers: a clean pin -- soft glow, coloured ring, white core
        for m in marks:
            k = m["kind"]
            uu = ease_out((t - t_zone[k]) / 0.6) * fade_wide
            if uu <= 0:
                continue
            x, y = scr(*V.px(None) if False else ((m["x"] - cx) * ppm_wide * SS + cw / 2, (m["y"] - cy) * ppm_wide * SS + ch / 2))
            col = ZONES[k][1]
            pulse = 0.5 + 0.5 * math.sin(2 * math.pi * 0.7 * t + order.index(k) * 1.3)
            _glow(img, x, y, 24, col, 0.5 * uu)
            cv2.circle(img, (int(x), int(y)), int(11 * uu), col[::-1], -1, cv2.LINE_AA)
            cv2.circle(img, (int(x), int(y)), int(5 * uu), INK[::-1], -1, cv2.LINE_AA)
            ov = img.copy()
            cv2.circle(ov, (int(x), int(y)), int(15 + 9 * pulse), col[::-1], 2, cv2.LINE_AA)
            cv2.addWeighted(ov, 0.45 * uu, img, 1 - 0.45 * uu, 0, img)
        # the wearer at the tower: a white beacon that GROWS as the camera arrives
        tx, ty = scr(txm, tym)
        u_you = ease_out((t - 0.2) / 0.6)
        if u_you > 0:
            p2 = 0.5 + 0.5 * math.sin(2 * math.pi * 1.0 * t)
            big = 1 + 0.9 * u
            _glow(img, tx, ty, 30 * big, INK, 0.45 * u_you)
            cv2.circle(img, (int(tx), int(ty)), int(9 * big * u_you), INK[::-1], -1, cv2.LINE_AA)
            cv2.circle(img, (int(tx), int(ty)), int((18 + 12 * p2) * big * u_you), INK[::-1], 2, cv2.LINE_AA)
        pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        d = ImageDraw.Draw(pil, "RGBA")

        def halo_text(xy, txt, fnt, alpha, anchor="lm", tracking=1.6):
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1)):
                _text(d, (xy[0] + dx, xy[1] + dy), txt, fnt, (*GROUND, int(220 * alpha)), anchor, tracking)
            _text(d, xy, txt, fnt, (*INK, int(240 * alpha)), anchor, tracking)

        # place names -- the same names the lens overlay will use two shots later
        for l in F["labels"]:
            if l["name"] == "VIEWING TOWER":
                continue
            x, y = scr_ll(l["ll"])
            uu = ease((t - 0.8) / 0.5) * fade_wide
            if uu <= 0 or not (60 < x < W - 60 and BAR + 30 < y < H - BAR - 30):
                continue
            halo_text((x + 16, y), l["name"], f_label, uu)
        if u_you > 0:
            a_you = u_you * (0.7 + 0.3 * u)
            halo_text((tx + 22 + 18 * u, ty - 4), "YOU ARE HERE", f_you, a_you, "lm", 2.2)
            halo_text((tx + 22 + 18 * u, ty + 24), "VIEWING TOWER", f_label, a_you * 0.85, "lm", 1.8)
        # title (top-left) and legend (bottom-right), stepping back with the push
        u_t = ease((t - 0.1) / 0.45) * fade_wide
        if u_t > 0:
            d.rectangle((72, BAR + 44, 72 + int(52 * u_t), BAR + 48), fill=(*AMBER, int(255 * u_t)))
            _text(d, (72, BAR + 64), "FALLS PARK", f_title, (*INK, int(255 * u_t)), "la", 1.5)
            _text(d, (72, BAR + 112), "EVERY STORY, PLACED", f_sub, (*SUBTLE, int(255 * u_t)), "la", 2.6)
        lx, ly = W - 72, H - BAR - 56
        for j, k in enumerate(reversed(order)):
            uu = ease((t - t_zone[k] - 0.05) / 0.4) * fade_wide
            if uu <= 0:
                continue
            y = ly - j * 40
            name, col = ZONES[k]
            d.ellipse((lx - 16 - 8, y - 8, lx - 16 + 8, y + 8), fill=(*col, int(255 * uu)))
            d.ellipse((lx - 16 - 3, y - 3, lx - 16 + 3, y + 3), fill=(*INK, int(255 * uu)))
            _text(d, (lx - 36, y), name, f_leg, (*INK, int(235 * uu)), "rm", 2.2)
        u_a = ease((t - 1.0) / 0.5) * fade_wide
        if u_a > 0:
            _text(d, (72, H - BAR - 40), "MAP DATA © OPENSTREETMAP CONTRIBUTORS", font("Medium", 13), (*SUBTLE, int(160 * u_a)), "la", 1.6)
        fr = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
        frames.append(fr)
    if preview_frames is not None:
        return frames
    sys.path.insert(0, HERE)
    sys_argv, sys.argv = sys.argv, [sys.argv[0]]
    import build
    sys.argv = sys_argv
    w = build.Writer(out_mp4)
    for fr in frames:
        w.write(fr)
    w.close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "fetch":
        fetch(); extract(); print("fetched + extracted", DATA)
    elif len(sys.argv) > 1 and sys.argv[1] == "preview":
        os.makedirs(f"{HERE}/work", exist_ok=True)
        fr = render(None, preview_frames=[12, 60, 95, 118])
        for i, f in zip((12, 60, 95, 118), fr):
            cv2.imwrite(f"{HERE}/work/map_preview_{i:02d}.png", f)
        print("previews written")
    else:
        render(sys.argv[1] if len(sys.argv) > 1 else f"{HERE}/work/map_test.mp4")
