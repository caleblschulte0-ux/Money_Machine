// A SYNTHETIC walk of a tour, for tests and the replay demo. It is generated
// from the route geometry, not recorded: nobody walked it. A real recorded
// walk (?record=1) dropped into content/<tour>/traces/ is replayed alongside.
//
// Deliberately unkind: GPS wanders by several metres, the compass jitters and
// throws occasional 60-90 degree spikes, the walker arrives facing the wrong
// way and turns, every footstep shows on the accelerometer. Seeded, so a
// failing test fails the same way twice.

import { bearing, distance, ll, norm, offset, turn } from "./geo.ts";
import { TRACE_SCHEMA, type Trace, type TraceSample } from "./replay.ts";
import { targetBearing } from "./tour.ts";
import type { LatLon, Tour, TourMap } from "./types.ts";

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
const gauss = (r: () => number): number => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

export interface SynthOptions {
  seed: number;
  walkMps: number;
  gpsErrM: number;
  /** seconds standing at each stop */
  standS: number;
  /** stop ids where the walker first stands facing away */
  wrongWay: string[];
  wrongWayS: number;
  /** one compass spike per about this many readings */
  spikeEvery: number;
}

export interface SyntheticTrace extends Trace {
  /** ground truth: was the walker really moving at each GPS sample */
  truth: { t: number; moving: boolean }[];
}

export function syntheticWalk(tour: Tour, map: TourMap, opts: Partial<SynthOptions> = {}): SyntheticTrace {
  const r = rng(opts.seed ?? 7);
  const walkMps = opts.walkMps ?? 1.3;
  const gpsErr = opts.gpsErrM ?? 3;
  const standS = opts.standS ?? 45;
  const wrongWay = new Set(opts.wrongWay ?? []);
  const wrongWayS = opts.wrongWayS ?? 8;
  const spikeEvery = opts.spikeEvery ?? 40;
  const samples: TraceSample[] = [];
  const truth: SyntheticTrace["truth"] = [];
  let t = 0;
  let pos: LatLon = { ...tour.start.position };
  let face = 180;
  const drift = { n: 0, e: 0 };

  const emitGps = (moving: boolean): void => {
    drift.n = drift.n * 0.85 + gauss(r) * gpsErr * 0.4;
    drift.e = drift.e * 0.85 + gauss(r) * gpsErr * 0.4;
    const p = offset(offset(pos, drift.n, 0), drift.e, 90);
    const tt = Math.round(t);
    samples.push({
      t: tt,
      lat: +p.lat.toFixed(7),
      lon: +p.lon.toFixed(7),
      acc: Math.round(gpsErr * 2 + r() * 3),
      speed: null,
    });
    truth.push({ t: tt, moving });
  };
  const emitHeading = (): void => {
    let h = face + gauss(r) * 4;
    if (r() < 1 / spikeEvery) h += (r() < 0.5 ? -1 : 1) * (60 + r() * 30);
    samples.push({ t: Math.round(t), heading: +norm(h).toFixed(1) });
  };
  const emitAccel = (moving: boolean): void => {
    const bounce = moving ? 2.2 * Math.sin((t / 550) * 2 * Math.PI) : 0;
    samples.push({ t: Math.round(t), a: +(9.81 + bounce + gauss(r) * (moving ? 0.3 : 0.08)).toFixed(3) });
  };

  let nextGps = 0;
  let nextHead = 0;
  let nextAcc = 0;
  const step = (dt: number, moving: boolean): void => {
    const end = t + dt * 1000;
    while (t < end) {
      if (t >= nextGps) {
        emitGps(moving);
        nextGps += 1000;
      }
      if (t >= nextHead) {
        emitHeading();
        nextHead += 100;
      }
      if (t >= nextAcc) {
        emitAccel(moving);
        nextAcc += 100;
      }
      t += 50;
    }
  };

  step(5, false);
  for (const leg of map.legs) {
    const stop = tour.stops.find((s) => s.id === leg.to);
    if (!stop) continue;
    for (let i = 0; i + 1 < leg.line.length; i++) {
      const pa = leg.line[i];
      const pb = leg.line[i + 1];
      if (!pa || !pb) continue;
      const a = ll(pa);
      const b = ll(pb);
      const d = distance(a, b);
      const brg = bearing(a, b);
      for (let m = 0; m < d; m += walkMps * 0.5) {
        pos = offset(a, m, brg);
        face = brg;
        step(0.5, true);
      }
    }
    pos = { ...stop.position };
    const target = targetBearing(stop);
    if (wrongWay.has(stop.id)) {
      face = norm(target + 150);
      step(wrongWayS, false);
    } else {
      face = norm(target + 70); // arrives facing along the path, not the landmark
      step(2, false);
    }
    while (Math.abs(turn(face, target)) > 3) {
      const d = turn(face, target);
      face = norm(face + Math.sign(d) * Math.min(4, Math.abs(d)));
      step(0.1, false);
    }
    step(standS, false);
  }
  step(10, true);
  return {
    schema: TRACE_SCHEMA,
    tour: tour.id,
    source: "synthetic",
    note: "Generated from the route geometry by src/core/synthwalk.ts. Nobody walked this.",
    samples,
    truth,
  };
}

/** The same walk as GPX: positions and times only, as a phone GPS logger app writes it. */
export function toGpx(trace: Trace, startIso = "2026-10-05T15:00:00Z"): string {
  const t0 = Date.parse(startIso);
  const pts = trace.samples
    .flatMap((x) =>
      "lat" in x
        ? [`<trkpt lat="${x.lat}" lon="${x.lon}"><time>${new Date(t0 + x.t).toISOString()}</time></trkpt>`]
        : [],
    )
    .join("\n");
  return `<?xml version="1.0"?>\n<gpx version="1.1" creator="ori synthwalk"><trk><trkseg>\n${pts}\n</trkseg></trk></gpx>\n`;
}
