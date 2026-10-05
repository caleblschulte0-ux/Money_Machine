// Walk replay: play a recorded walk through the real engine on a virtual
// clock, so the tour is tested without being at the park.
//
// Trace format "ori.trace/1" (what ?record=1 saves on a phone; see
// schemas/ori.trace-1.schema.json):
//   { schema, tour, source: "recorded" | "synthetic", device, recorded, note,
//     samples: [ {t, lat, lon, acc, speed?}   a GPS fix
//                {t, heading}                 a raw compass reading
//                {t, a} ] }                   |acceleration| m/s^2
// t is milliseconds from the start of the walk. GPX (from any GPS logger app)
// is accepted too: positions and times only, so the replay derives a heading
// from the direction of travel, and when the walker stops inside a stop's
// circle it ASSUMES they faced that stop's landmark. A GPX replay therefore
// tests arriving and standing, not facing.
import { TourEngine } from "./engine.js";
import { bearing, distance } from "./geo.js";
import { targetBearing } from "./tour.js";
export const TRACE_SCHEMA = "ori.trace/1";
export const isFix = (x) => "lat" in x;
export const isHeading = (x) => "heading" in x;
export const isMotion = (x) => "a" in x;
export function parseGpx(xml) {
    const pts = [];
    const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
    let m;
    while ((m = re.exec(xml))) {
        const attrs = m[1] ?? "";
        const body = m[2] ?? "";
        const lat = Number(/lat="([^"]+)"/.exec(attrs)?.[1]);
        const lon = Number(/lon="([^"]+)"/.exec(attrs)?.[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon))
            continue;
        const time = /<time>([^<]+)<\/time>/.exec(body)?.[1];
        const hdop = /<hdop>([^<]+)<\/hdop>/.exec(body)?.[1];
        const speed = /<(?:\w+:)?speed>([^<]+)<\/(?:\w+:)?speed>/.exec(body)?.[1];
        pts.push({
            ms: time ? Date.parse(time) : null,
            lat,
            lon,
            acc: hdop ? Number(hdop) * 5 : 5,
            speed: speed ? Number(speed) : null,
        });
    }
    const t0 = pts[0]?.ms;
    if (t0 === undefined)
        throw new Error("GPX has no track points");
    return {
        schema: TRACE_SCHEMA,
        source: "gpx",
        headingless: true,
        samples: pts.map((p, i) => ({
            t: p.ms != null && t0 != null ? p.ms - t0 : i * 1000,
            lat: p.lat,
            lon: p.lon,
            acc: p.acc,
            speed: p.speed,
        })),
    };
}
/** Parse an ori.trace/1 JSON file or a GPX file. */
export function parseTrace(text) {
    const s = text.trimStart();
    if (s.startsWith("<"))
        return parseGpx(s);
    const trace = JSON.parse(s);
    const schema = trace.schema;
    if (schema !== TRACE_SCHEMA)
        throw new Error(`trace schema is ${String(schema)}, expected ${TRACE_SCHEMA}`);
    trace.samples.sort((a, b) => a.t - b.t);
    return trace;
}
/** How long a stop's narration runs: the audio's measured length, else 150 words a minute. */
export function narrationMs(stop) {
    if (stop.narration.duration_s)
        return stop.narration.duration_s * 1000;
    return (stop.narration.text.split(/\s+/).length / 2.5) * 1000;
}
/** Feed one sample to an engine. */
export function feed(engine, x) {
    if (isFix(x))
        engine.location({ t: x.t, pos: { lat: x.lat, lon: x.lon }, accuracy: x.acc ?? 5, speed: x.speed ?? null });
    else if (isHeading(x))
        engine.heading(x.heading, x.t);
    else if (isMotion(x))
        engine.motion(x.a, x.t);
}
/** For headingless traces: travel direction while moving, the landmark when stopped at a stop. */
export function withDerivedHeadings(tour, trace) {
    if (!trace.headingless)
        return trace.samples;
    const gps = trace.samples.filter(isFix);
    const out = [];
    for (let i = 1; i < gps.length; i++) {
        const a = gps[i - 1];
        const b = gps[i];
        if (!a || !b)
            continue;
        if (distance(a, b) > 1)
            out.push({ t: b.t, heading: bearing(a, b) });
        else {
            const stop = tour.stops.find((s) => distance(b, s.position) <= s.radius_m);
            if (stop)
                out.push({ t: b.t, heading: targetBearing(stop) });
        }
    }
    return [...trace.samples, ...out].sort((x, y) => x.t - y.t);
}
/** Run a trace through a fresh engine on a virtual clock. */
export function replay(tour, trace, opts = {}) {
    const tickMs = opts.tickMs ?? 250;
    const events = [];
    const shown = [];
    const violations = [];
    let pendingEnd = null;
    const engine = new TourEngine(tour, {
        ...opts.engine,
        onEvent: (e) => {
            events.push({ type: e.type, ...("stop" in e ? { stop: e.stop.id } : {}), t: e.t });
            if (e.type === "narrate")
                pendingEnd = { id: e.stop.id, at: e.t + narrationMs(e.stop) };
        },
    });
    const samples = withDerivedHeadings(tour, trace);
    const end = (samples[samples.length - 1]?.t ?? 0) + (opts.tailMs ?? 30000);
    let i = 0;
    let lastShown = null;
    for (let t = 0; t <= end; t += tickMs) {
        for (let x = samples[i]; x && x.t <= t; x = samples[++i])
            feed(engine, x);
        const pe = pendingEnd;
        if (pe && t >= pe.at) {
            pendingEnd = null;
            engine.narrationEnded(pe.id, t);
        }
        const s = engine.tick(t);
        const id = s.showing ? s.showing.id : null;
        if (id !== lastShown) {
            shown.push({ t, stop: id, speed: s.speed, moving: s.moving });
            lastShown = id;
        }
        if (id && s.moving && !s.forced && tour.safety.pictures_only_when_still) {
            violations.push({ t, stop: id, why: "scene visible while walking" });
        }
    }
    return { events, shown, violations, visited: [...engine.state.visited], done: engine.state.done, engine };
}
