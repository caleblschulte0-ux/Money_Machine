#!/usr/bin/env python3
"""Build content/falls-park/map.json from real OpenStreetMap geometry.

Input: tools/falls_park_osm.json, the compact OSM extraction the ORI promo
committed (branch claude/open-range-promo-video-4n7k7o,
ori_promo/promo/data/falls_park.json). OSM data is ODbL:
"(c) OpenStreetMap contributors".

Output: the map layers the app draws, plus a walking route between the
stops in content/falls-park/tour.json, routed over mapped paths only
(no steps, no roads), so the line on the map follows real walkways.

    python3 ori_tour/tools/build_map.py
"""
import heapq
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "falls_park_osm.json")
TOUR = os.path.join(HERE, "..", "content", "falls-park", "tour.json")
OUT = os.path.join(HERE, "..", "content", "falls-park", "map.json")

LAYERS = ["water", "rock", "park", "paths", "steps", "roads", "buildings", "historic", "weir"]


def dist(a, b):
    dx = (b[1] - a[1]) * math.cos(math.radians(a[0])) * 111320.0
    dy = (b[0] - a[0]) * 110574.0
    return math.hypot(dx, dy)


def r6(p):
    return [round(p[0], 6), round(p[1], 6)]


def graph(ways):
    """Nodes keyed by rounded coordinate, so ways that share a junction join."""
    g = {}
    for w in ways:
        for a, b in zip(w, w[1:]):
            ka, kb = tuple(r6(a)), tuple(r6(b))
            d = dist(a, b)
            g.setdefault(ka, []).append((kb, d))
            g.setdefault(kb, []).append((ka, d))
    return g


def nearest(g, p):
    return min(g, key=lambda k: dist(k, p))


def route(g, a, b):
    s, t = nearest(g, a), nearest(g, b)
    best, prev, q = {s: 0.0}, {}, [(0.0, s)]
    while q:
        d, u = heapq.heappop(q)
        if u == t:
            break
        if d > best.get(u, 1e18):
            continue
        for v, w in g[u]:
            nd = d + w
            if nd < best.get(v, 1e18):
                best[v], prev[v] = nd, u
                heapq.heappush(q, (nd, v))
    if t not in best:
        return None
    line, u = [t], t
    while u != s:
        u = prev[u]
        line.append(u)
    line.reverse()
    return [list(a)] + [list(p) for p in line] + [list(b)]


def length(line):
    return sum(dist(a, b) for a, b in zip(line, line[1:]))


def main():
    src = json.load(open(SRC))
    tour = json.load(open(TOUR))
    out = {
        "attribution": "Map data (c) OpenStreetMap contributors, ODbL",
        "layers": {k: [[r6(p) for p in ring] for ring in src.get(k, [])] for k in LAYERS},
        "labels": [{"name": l["name"], "ll": r6(l["ll"])} for l in src.get("labels", [])],
        "legs": [],
    }
    g = graph(src["paths"])
    pts = [("start", tour["start"]["position"])] + [(s["id"], s["position"]) for s in tour["stops"]]
    for (ia, pa), (ib, pb) in zip(pts, pts[1:]):
        a, b = [pa["lat"], pa["lon"]], [pb["lat"], pb["lon"]]
        line = route(g, a, b) or [a, b]
        out["legs"].append({"from": ia, "to": ib, "routed": len(line) > 2,
                            "metres": round(length(line)), "line": [r6(p) for p in line]})
        print(f"{ia} -> {ib}: {round(length(line))} m, {'routed on paths' if len(line) > 2 else 'STRAIGHT (no path link)'}")
    json.dump(out, open(OUT, "w"), separators=(",", ":"))
    print(f"wrote {OUT} ({os.path.getsize(OUT) // 1024} KB), total {sum(l['metres'] for l in out['legs'])} m")


if __name__ == "__main__":
    main()
