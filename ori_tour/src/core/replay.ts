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

import { TourEngine, type EngineOptions } from "./engine.ts";
import { bearing, distance } from "./geo.ts";
import { targetBearing } from "./tour.ts";
import type { Stop, Tour } from "./types.ts";

export const TRACE_SCHEMA = "ori.trace/1";

export type TraceSample =
  | { t: number; lat: number; lon: number; acc?: number; speed?: number | null }
  | { t: number; heading: number }
  | { t: number; a: number };

export interface Trace {
  schema: typeof TRACE_SCHEMA;
  tour?: string;
  source: "recorded" | "synthetic" | "gpx";
  device?: string;
  recorded?: string;
  note?: string;
  /** GPX: no compass in the file */
  headingless?: boolean;
  samples: TraceSample[];
}

export const isFix = (x: TraceSample): x is Extract<TraceSample, { lat: number }> => "lat" in x;
export const isHeading = (x: TraceSample): x is Extract<TraceSample, { heading: number }> => "heading" in x;
export const isMotion = (x: TraceSample): x is Extract<TraceSample, { a: number }> => "a" in x;

export function parseGpx(xml: string): Trace {
  const pts: { ms: number | null; lat: number; lon: number; acc: number; speed: number | null }[] = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1] ?? "";
    const body = m[2] ?? "";
    const lat = Number(/lat="([^"]+)"/.exec(attrs)?.[1]);
    const lon = Number(/lon="([^"]+)"/.exec(attrs)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
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
  if (t0 === undefined) throw new Error("GPX has no track points");
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
export function parseTrace(text: string): Trace {
  const s = text.trimStart();
  if (s.startsWith("<")) return parseGpx(s);
  const trace = JSON.parse(s) as Trace;
  const schema: unknown = (trace as { schema?: unknown }).schema;
  if (schema !== TRACE_SCHEMA) throw new Error(`trace schema is ${String(schema)}, expected ${TRACE_SCHEMA}`);
  trace.samples.sort((a, b) => a.t - b.t);
  return trace;
}

/** How long a stop's narration runs: the audio's measured length, else 150 words a minute. */
export function narrationMs(stop: Stop): number {
  if (stop.narration.duration_s) return stop.narration.duration_s * 1000;
  return (stop.narration.text.split(/\s+/).length / 2.5) * 1000;
}

/** Feed one sample to an engine. */
export function feed(engine: TourEngine, x: TraceSample): void {
  if (isFix(x))
    engine.location({ t: x.t, pos: { lat: x.lat, lon: x.lon }, accuracy: x.acc ?? 5, speed: x.speed ?? null });
  else if (isHeading(x)) engine.heading(x.heading, x.t);
  else if (isMotion(x)) engine.motion(x.a, x.t);
}

/** For headingless traces: travel direction while moving, the landmark when stopped at a stop. */
export function withDerivedHeadings(tour: Tour, trace: Trace): TraceSample[] {
  if (!trace.headingless) return trace.samples;
  const gps = trace.samples.filter(isFix);
  const out: TraceSample[] = [];
  for (let i = 1; i < gps.length; i++) {
    const a = gps[i - 1];
    const b = gps[i];
    if (!a || !b) continue;
    if (distance(a, b) > 1) out.push({ t: b.t, heading: bearing(a, b) });
    else {
      const stop = tour.stops.find((s) => distance(b, s.position) <= s.radius_m);
      if (stop) out.push({ t: b.t, heading: targetBearing(stop) });
    }
  }
  return [...trace.samples, ...out].sort((x, y) => x.t - y.t);
}

export interface ReplayLog {
  events: { type: string; stop?: string; t: number }[];
  shown: { t: number; stop: string | null; speed: number; moving: boolean }[];
  violations: { t: number; stop: string; why: string }[];
  visited: string[];
  done: boolean;
  engine: TourEngine;
}

/** Run a trace through a fresh engine on a virtual clock. */
export function replay(
  tour: Tour,
  trace: Trace,
  opts: { tickMs?: number; tailMs?: number; engine?: Omit<EngineOptions, "onEvent"> } = {},
): ReplayLog {
  const tickMs = opts.tickMs ?? 250;
  const events: ReplayLog["events"] = [];
  const shown: ReplayLog["shown"] = [];
  const violations: ReplayLog["violations"] = [];
  let pendingEnd: { id: string; at: number } | null = null;
  const engine = new TourEngine(tour, {
    ...opts.engine,
    onEvent: (e) => {
      events.push({ type: e.type, ...("stop" in e ? { stop: e.stop.id } : {}), t: e.t });
      if (e.type === "narrate") pendingEnd = { id: e.stop.id, at: e.t + narrationMs(e.stop) };
    },
  });
  const samples = withDerivedHeadings(tour, trace);
  const end = (samples[samples.length - 1]?.t ?? 0) + (opts.tailMs ?? 30000);
  let i = 0;
  let lastShown: string | null = null;
  for (let t = 0; t <= end; t += tickMs) {
    for (let x = samples[i]; x && x.t <= t; x = samples[++i]) feed(engine, x);
    const pe = pendingEnd as { id: string; at: number } | null;
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
