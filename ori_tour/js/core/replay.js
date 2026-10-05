// Walk replay: play a recorded walk through the real engine on a virtual
// clock, so the tour can be tested without being at the park.
//
// Trace format "ori.trace/1" (what ?record=1 saves on a phone):
//   { schema, tour, source: "recorded" | "synthetic", device, recorded, note,
//     samples: [ {t, lat, lon, acc, speed?}   a GPS fix
//                {t, heading}                 a raw compass reading
//                {t, a} ] }                   |acceleration| m/s^2
// t is milliseconds from the start of the walk. GPX (from any GPS logger app)
// is accepted too: it has positions and times only, so the replay derives a
// heading from the direction of travel, and when the walker stops inside a
// stop's circle it ASSUMES they faced that stop's landmark. A GPX replay
// therefore tests arriving and standing, not facing.

import { TourEngine } from "./engine.js";
import { bearing, distance } from "./geo.js";
import { targetBearing } from "./tour.js";

export const TRACE_SCHEMA = "ori.trace/1";

export function parseGpx(xml) {
  const pts = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
  let m;
  while ((m = re.exec(xml))) {
    const lat = +/lat="([^"]+)"/.exec(m[1])[1];
    const lon = +/lon="([^"]+)"/.exec(m[1])[1];
    const time = /<time>([^<]+)<\/time>/.exec(m[2]);
    const hdop = /<hdop>([^<]+)<\/hdop>/.exec(m[2]);
    const speed = /<(?:\w+:)?speed>([^<]+)<\/(?:\w+:)?speed>/.exec(m[2]);
    pts.push({ ms: time ? Date.parse(time[1]) : null, lat, lon, acc: hdop ? +hdop[1] * 5 : 5, speed: speed ? +speed[1] : null });
  }
  if (!pts.length) throw new Error("GPX has no track points");
  const t0 = pts[0].ms ?? 0;
  return {
    schema: TRACE_SCHEMA,
    source: "gpx",
    headingless: true,
    samples: pts.map((p, i) => ({ t: p.ms != null ? p.ms - t0 : i * 1000, lat: p.lat, lon: p.lon, acc: p.acc, speed: p.speed })),
  };
}

export function parseTrace(text) {
  const s = text.trimStart();
  if (s.startsWith("<")) return parseGpx(s);
  const trace = JSON.parse(s);
  if (trace.schema !== TRACE_SCHEMA) throw new Error(`trace schema is ${trace.schema}, expected ${TRACE_SCHEMA}`);
  trace.samples.sort((a, b) => a.t - b.t);
  return trace;
}

// How long a stop's narration runs: the generated audio's measured length when
// there is one, otherwise a speaking pace of 150 words a minute.
export function narrationMs(stop) {
  if (stop.narration.duration_s) return stop.narration.duration_s * 1000;
  return (stop.narration.text.split(/\s+/).length / 2.5) * 1000;
}

// For headingless traces: travel direction while moving, the landmark when
// stopped inside a stop's circle. Returns extra {t, heading} samples.
function deriveHeadings(tour, gps) {
  const out = [];
  for (let i = 1; i < gps.length; i++) {
    const a = gps[i - 1], b = gps[i];
    const here = { lat: b.lat, lon: b.lon };
    if (distance(a, here) > 1) out.push({ t: b.t, heading: bearing(a, here) });
    else {
      const stop = tour.stops.find((s) => distance(here, s.position) <= s.radius_m);
      if (stop) out.push({ t: b.t, heading: targetBearing(stop) });
    }
  }
  return out;
}

// Run a trace through a fresh engine. Returns a log the tests (and the
// browser replay panel) read: every event, and every change of what is shown.
export function replay(tour, trace, opts = {}) {
  const tickMs = opts.tickMs || 250;
  const log = { events: [], shown: [], violations: [] };
  let pendingEnd = null;
  const engine = new TourEngine(tour, {
    ...opts.engine,
    onEvent: (e) => {
      log.events.push({ type: e.type, stop: e.stop?.id, t: e.t });
      if (e.type === "narrate") pendingEnd = { id: e.stop.id, at: e.t + narrationMs(e.stop) };
    },
  });
  let samples = trace.samples;
  if (trace.headingless) {
    const gps = samples.filter((x) => x.lat != null);
    samples = [...samples, ...deriveHeadings(tour, gps)].sort((a, b) => a.t - b.t);
  }
  const end = (samples.length ? samples[samples.length - 1].t : 0) + (opts.tailMs ?? 30000);
  let i = 0;
  let lastShown = null;
  for (let t = 0; t <= end; t += tickMs) {
    while (i < samples.length && samples[i].t <= t) {
      const x = samples[i++];
      if (x.lat != null) engine.location({ t: x.t, pos: { lat: x.lat, lon: x.lon }, accuracy: x.acc ?? 5, speed: x.speed ?? null });
      else if (x.heading != null) engine.heading(x.heading, x.t);
      else if (x.a != null) engine.motion(x.a, x.t);
    }
    if (pendingEnd && t >= pendingEnd.at) {
      const id = pendingEnd.id;
      pendingEnd = null;
      engine.narrationEnded(id, t);
    }
    const s = engine.tick(t);
    const shown = s.showing ? s.showing.id : null;
    if (shown !== lastShown) {
      log.shown.push({ t, stop: shown, speed: s.speed, moving: s.moving });
      lastShown = shown;
    }
    if (shown && s.moving && !s.forced && tour.safety.pictures_only_when_still) {
      log.violations.push({ t, stop: shown, why: "scene visible while walking" });
    }
  }
  log.visited = [...engine.state.visited];
  log.done = engine.state.done;
  log.engine = engine;
  return log;
}
