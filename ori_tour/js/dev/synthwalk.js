// A SYNTHETIC walk of a tour, for tests and the browser replay panel. It is
// generated from the route geometry, not recorded: nobody walked it. A real
// recorded walk (?record=1 on a phone at the park) replaces it as the
// reference once one exists.
//
// It is deliberately unkind: GPS wanders by several metres, the compass
// jitters and throws occasional 60-90 degree spikes, the walker arrives
// facing the wrong way and turns, and every footstep shows on the
// accelerometer. Seeded, so a failing test fails the same way twice.

import { bearing, distance, offset, ll, norm } from "../core/geo.js";
import { targetBearing } from "../core/tour.js";
import { TRACE_SCHEMA } from "../core/replay.js";

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

// opts.standS: seconds standing at each stop; opts.wrongWay: stop ids where the
// walker first stands facing away for opts.wrongWayS before turning to the landmark.
export function syntheticWalk(tour, map, opts = {}) {
  const r = rng(opts.seed ?? 7);
  const walkMps = opts.walkMps ?? 1.3;
  const gpsErr = opts.gpsErrM ?? 3;
  const standS = opts.standS ?? 45;
  const wrongWay = new Set(opts.wrongWay || []);
  const wrongWayS = opts.wrongWayS ?? 8;
  const spikeEvery = opts.spikeEvery ?? 40; // one compass spike per ~N readings
  const samples = [];
  let t = 0;
  let pos = { ...tour.start.position };
  let face = 180;
  let drift = { n: 0, e: 0 }; // GPS error wanders slowly, as real fixes do

  const emitGps = (moving) => {
    drift.n = drift.n * 0.85 + gauss(r) * gpsErr * 0.4;
    drift.e = drift.e * 0.85 + gauss(r) * gpsErr * 0.4;
    const p = offset(offset(pos, drift.n, 0), drift.e, 90);
    samples.push({ t: Math.round(t), lat: +p.lat.toFixed(7), lon: +p.lon.toFixed(7), acc: Math.round(gpsErr * 2 + r() * 3), speed: null, _moving: moving });
  };
  const emitHeading = () => {
    let h = face + gauss(r) * 4;
    if (r() < 1 / spikeEvery) h += (r() < 0.5 ? -1 : 1) * (60 + r() * 30);
    samples.push({ t: Math.round(t), heading: +norm(h).toFixed(1) });
  };
  const emitAccel = (moving, phase) => {
    const bounce = moving ? 2.2 * Math.sin(phase * 2 * Math.PI) : 0;
    samples.push({ t: Math.round(t), a: +(9.81 + bounce + gauss(r) * (moving ? 0.3 : 0.08)).toFixed(3) });
  };

  // advance the clock by dt seconds, emitting sensors at their rates
  let nextGps = 0, nextHead = 0, nextAcc = 0;
  const step = (dt, moving) => {
    const end = t + dt * 1000;
    while (t < end) {
      if (t >= nextGps) { emitGps(moving); nextGps += 1000; }
      if (t >= nextHead) { emitHeading(); nextHead += 100; }
      if (t >= nextAcc) { emitAccel(moving, t / 550); nextAcc += 100; }
      t += 50;
    }
  };

  step(5, false);
  for (const leg of map.legs) {
    const stop = tour.stops.find((s) => s.id === leg.to);
    for (let i = 0; i + 1 < leg.line.length; i++) {
      const a = ll(leg.line[i]), b = ll(leg.line[i + 1]);
      const d = distance(a, b), brg = bearing(a, b);
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
    // turn toward the landmark over about two seconds
    while (Math.abs(((target - face + 540) % 360) - 180) > 3) {
      const d = ((target - face + 540) % 360) - 180;
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
    note: "Generated from the route geometry by js/dev/synthwalk.js. Nobody walked this.",
    samples: samples.map(({ _moving, ...x }) => x),
    truth: samples.filter((x) => x._moving != null).map((x) => ({ t: x.t, moving: x._moving })),
  };
}

// The same walk as GPX: positions and times only, as a phone GPS logger app writes it.
export function toGpx(trace, startIso = "2026-10-05T15:00:00Z") {
  const t0 = Date.parse(startIso);
  const pts = trace.samples
    .filter((x) => x.lat != null)
    .map((x) => `<trkpt lat="${x.lat}" lon="${x.lon}"><time>${new Date(t0 + x.t).toISOString()}</time></trkpt>`)
    .join("\n");
  return `<?xml version="1.0"?>\n<gpx version="1.1" creator="ori synthwalk"><trk><trkseg>\n${pts}\n</trkseg></trk></gpx>\n`;
}
