// Test anywhere: move a tour to where the tester is standing.
//
// The Falls Park stops trigger only at Falls Park, so a test in a parking lot
// would show nothing and read as "GPS doesn't work". relocate() keeps the
// tour's shape (the stops' layout relative to the start, and which way each
// stop faces relative to that layout), shrinks or grows it to parking-lot
// distances, turns it so stop 1 is straight ahead of the tester, and puts it
// down around them. Everything else (narration, scenes, the trigger rules) is
// the real tour, so what triggers in the lot is what will trigger in the park.
//
// The relocated package says so in its title, status and every placement, and
// carries no map layers (the park's paths would be meaningless there).
import { bearing, distance, norm, offset } from "./geo.js";
import { targetBearing } from "./tour.js";
export const RELOCATE_DEFAULTS = {
    minSpacingM: 25,
    maxSpanM: 70,
    radiusM: 8,
    facingDeg: null,
};
export function relocate(tour, here, opts = {}) {
    const o = { ...RELOCATE_DEFAULTS, ...opts };
    const origin = tour.start.position;
    const polar = tour.stops.map((s) => ({ d: distance(origin, s.position), b: bearing(origin, s.position) }));
    const pts = [origin, ...tour.stops.map((s) => s.position)];
    let minPair = Infinity;
    for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
            const a = pts[i];
            const b = pts[j];
            if (a && b)
                minPair = Math.min(minPair, distance(a, b));
        }
    const span = Math.max(...polar.map((p) => p.d), 1);
    // Big enough that no two points are closer than minSpacing, small enough to fit the lot.
    let scale = minPair > 0 && Number.isFinite(minPair) ? o.minSpacingM / minPair : 1;
    if (span * scale > o.maxSpanM)
        scale = o.maxSpanM / span;
    const first = polar[0];
    const rotation = o.facingDeg != null && first ? norm(o.facingDeg - first.b) : 0;
    const out = JSON.parse(JSON.stringify(tour));
    out.title = `${tour.title} (test layout)`;
    out.subtitle = "Relocated around you for testing";
    out.status =
        `TEST LAYOUT. The ${tour.title} stops, moved to where you started and scaled to ${Math.round(scale * 100)}% ` +
            `so they fit a parking lot. Same narration and trigger rules as the real tour.`;
    out.start = { name: "Where you started", position: { ...here } };
    out.stops.forEach((s, i) => {
        const p = polar[i];
        if (!p)
            return;
        const orig = tour.stops[i];
        s.position = offset(here, p.d * scale, norm(p.b + rotation));
        s.radius_m = o.radiusM;
        if (orig)
            s.facing.bearing_deg = Math.round(norm(targetBearing(orig) + rotation));
        delete s.facing.target;
        s.placement = "relocated for testing (test-anywhere mode)";
    });
    const all = [out.start.position, ...out.stops.map((s) => s.position)];
    const legs = out.stops.map((s, i) => {
        const a = all[i] ?? here;
        return {
            from: i === 0 ? "start" : (out.stops[i - 1]?.id ?? "start"),
            to: s.id,
            routed: false,
            metres: Math.round(distance(a, s.position)),
            line: [
                [a.lat, a.lon],
                [s.position.lat, s.position.lon],
            ],
        };
    });
    const outMap = { attribution: "", layers: {}, labels: [], legs };
    return { tour: out, map: outMap, scale, rotation };
}
