// The ViewModel: everything any display needs, decided once, device-neutral.
// A phone draws all of it; 600x600 glasses draw the scene, the guide line and
// the caption; a Lens Studio port anchors the scene in the world. None of them
// re-derive what to say.
import { bearing, compassWord, distance, turn } from "./geo.js";
import { targetBearing } from "./tour.js";
export function guidance(engine, opts = {}) {
    const hasMap = opts.hasMap ?? true;
    const st = engine.state;
    const next = engine.tour.stops.find((s) => s.id === st.nextId);
    if (!next)
        return { arrow: null, title: "Tour complete", detail: "Head back to the start when you're ready." };
    if (!st.pos)
        return { arrow: null, title: `Stop ${next.order}: ${next.name}`, detail: st.error ?? "Waiting for GPS…" };
    if (st.atStop) {
        const s = st.atStop;
        const t = targetBearing(s);
        if (st.heading == null) {
            return {
                arrow: null,
                title: s.facing.hint,
                detail: `Face ${compassWord(t)}, toward ${s.facing.target_name}. No compass here: tap "Show scene".`,
            };
        }
        if (!st.facing && engine.requireFacing) {
            const d = turn(st.heading, t);
            return {
                arrow: d,
                title: s.facing.hint,
                detail: `Turn ${d > 0 ? "right" : "left"} about ${Math.abs(Math.round(d / 5) * 5)}°, toward ${s.facing.target_name}` +
                    (st.headingSteady ? "" : `. Compass unsteady: if you are facing it, tap "I'm facing it".`),
            };
        }
        return { arrow: null, title: "Stand still for a moment", detail: "The scene appears when you stop walking." };
    }
    const d = distance(st.pos, next.position);
    const b = bearing(st.pos, next.position);
    return {
        arrow: st.heading == null ? null : turn(st.heading, b),
        title: `Stop ${next.order}: ${next.name}`,
        detail: `${Math.round(d)} m ${st.heading == null ? compassWord(b) : "ahead"}${hasMap ? " · follow the bright line on the map" : ""}`,
    };
}
function readout(engine) {
    const st = engine.state;
    const next = engine.tour.stops.find((s) => s.id === st.nextId) ?? null;
    return {
        accuracyM: st.accuracy,
        headingDeg: st.heading,
        headingSteady: st.headingSteady,
        speedMps: st.speed,
        moving: st.moving,
        still: st.still,
        stillSource: st.stillSource,
        next: next && {
            name: next.name,
            order: next.order,
            radiusM: next.radius_m,
            distanceM: st.pos ? distance(st.pos, next.position) : null,
            bearingDeg: st.pos ? bearing(st.pos, next.position) : null,
        },
        offTargetDeg: st.atStop && st.heading != null ? turn(st.heading, targetBearing(st.atStop)) : null,
        facing: st.facing,
    };
}
export function buildView(engine, caption, opts = {}) {
    const st = engine.state;
    return {
        mode: st.showing ? "scene" : "guide",
        scene: st.showing,
        guide: guidance(engine, opts),
        caption,
        status: {
            gps: {
                text: st.error ? st.error : st.pos ? `GPS ±${Math.round(st.accuracy ?? 0)} m` : "Finding GPS…",
                level: st.error ? "bad" : st.accuracy != null && st.accuracy <= 10 ? "ok" : "warn",
            },
            heading: {
                text: st.heading == null ? "No compass" : `Facing ${Math.round(st.heading)}° ${compassWord(st.heading)}`,
                level: st.heading == null ? "warn" : st.headingSteady ? "ok" : "warn",
            },
            movement: {
                text: st.moving ? "Walking · audio only" : st.still ? "Still" : "Stopping…",
                level: "ok",
            },
        },
        sensors: readout(engine),
        controls: { calibrate: !!(st.atStop && st.raw != null), force: !st.showing, skip: !!st.nextId },
        progress: { visited: st.visited, nextId: st.nextId, legIndex: st.legIndex, done: st.done },
    };
}
