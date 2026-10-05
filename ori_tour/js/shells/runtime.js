// What every shell shares: the engine, the narrator, and the sources that feed
// the engine (live sensors, the simulator, a replayed walk). A shell (phone,
// glasses) only decides how state is drawn and which controls exist.

import { TourEngine } from "../core/engine.js";
import { bearing, distance, offset, ll, turn, compassWord } from "../core/geo.js";
import { parseTrace } from "../core/replay.js";
import { targetBearing } from "../core/tour.js";
import { LiveLocation, LiveHeading, LiveMotion, SimSensors, Recorder, requestMotionPermission } from "../device/sensors.js";
import { Narrator } from "../ui/narrator.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Runtime {
  constructor(tour, map, params, base) {
    this.tour = tour;
    this.map = map;
    this.params = params;
    this.base = base;
    this.listeners = [];
    this.virtual = null; // replay clock, ms; null = wall clock
    this.engine = new TourEngine(tour, {
      requireFacing: params.get("facing") !== "off",
      onEvent: (e) => this.event(e),
    });
    this.st = this.engine.state;
    this.narrator = new Narrator((c) => this.emit({ type: "caption", text: c }), () => {});
    if (params.get("record") === "1") this.recorder = new Recorder(tour.id);
  }

  now() {
    return this.virtual ?? Date.now();
  }

  on(fn) {
    this.listeners.push(fn);
  }

  emit(e) {
    for (const fn of this.listeners) fn(e, this);
  }

  event(e) {
    if (e.type === "narrate") {
      const stop = e.stop;
      this.narrator.onEnd = () => this.engine.narrationEnded(stop.id, this.now());
      this.narrator.play(stop.narration);
    }
    if (e.type === "stop-done") {
      this.emit({ type: "toast", text: e.next ? `Stop ${e.stop.order} done. Next: ${e.next.name}.` : "Tour complete. Thanks for walking it." });
    }
    this.emit(e);
  }

  changed() {
    this.emit({ type: "render" });
  }

  // ------------------------------------------------------------ sources

  onFix = (f) => {
    this.recorder?.fix(f);
    this.engine.location(f);
    this.changed();
  };

  onHeading = (h, t) => {
    this.recorder?.heading(h, t);
    this.engine.heading(h, t);
    this.changed();
  };

  onMotion = (a, t) => {
    this.recorder?.motion(a, t);
    this.engine.motion(a, t);
  };

  async start(mode) {
    this.narrator.unlock();
    try { await navigator.wakeLock?.request("screen"); } catch { /* not supported */ }
    this.mode = mode;
    if (mode === "sim") {
      this.sim = new SimSensors(this.tour.start.position, this.onFix, this.onHeading);
      this.sim.face(bearing(this.tour.start.position, this.tour.stops[0].position));
      this.sim.set(this.tour.start.position, 0);
    } else if (mode === "replay") {
      this.replayWalk(this.params.get("replay"));
    } else {
      const err = await requestMotionPermission();
      if (err) this.emit({ type: "toast", text: err });
      this.head = new LiveHeading(this.onHeading);
      this.head.start();
      new LiveMotion(this.onMotion).start();
      this.loc = new LiveLocation(this.onFix);
      this.loc.start();
    }
    // keeps "still for N seconds" moving with no new reading
    this.timer = setInterval(() => { this.engine.tick(this.now()); this.changed(); }, 250);
    this.changed();
  }

  positionSource() {
    return this.loc || this.sim;
  }

  // ------------------------------------------------------------ commands

  calibrate() {
    if (this.engine.calibrate(this.now())) this.emit({ type: "toast", text: `Compass set: you are facing ${this.st.atStop.facing.target_name}.` });
    this.changed();
  }
  force() { this.engine.force(this.now()); this.changed(); }
  skip() { this.narrator.stop(); this.engine.skip(this.now()); this.changed(); }

  // ------------------------------------------------------------ simulator demo

  // Walks the whole route: along each leg (audio-only while moving), then
  // arrives, turns to face the landmark, stands still for the scene.
  async demo() {
    const speedup = +(this.params.get("speedup") || 6);
    const sim = this.sim;
    for (const leg of this.map.legs) {
      const stop = this.tour.stops.find((s) => s.id === leg.to);
      for (let i = 0; i + 1 < leg.line.length; i++) {
        const a = ll(leg.line[i]), b = ll(leg.line[i + 1]);
        const d = distance(a, b), brg = bearing(a, b);
        for (let m = 0; m < d; m += 1.4 * speedup * 0.25) {
          sim.face(brg);
          sim.set(offset(a, m, brg), 1.4);
          await sleep(250);
        }
      }
      sim.set(stop.position, 0);
      await sleep(800);
      const t = targetBearing(stop);
      while (Math.abs(turn(sim.heading, t)) > 3) {
        sim.face(sim.heading + Math.sign(turn(sim.heading, t)) * Math.min(6, Math.abs(turn(sim.heading, t))));
        await sleep(60);
      }
      while (!this.st.visited.has(stop.id)) { sim.set(sim.pos, 0); await sleep(250); }
      await sleep(600);
    }
  }

  // ------------------------------------------------------------ replay in the browser

  // ?replay=synthetic, or ?replay=<file under the tour's traces/ folder>.
  // Plays the walk through the real engine on a virtual clock, sped up.
  async replayWalk(which) {
    const speedup = +(this.params.get("speedup") || 4);
    let trace;
    if (!which || which === "synthetic") {
      const { syntheticWalk } = await import("../dev/synthwalk.js");
      trace = syntheticWalk(this.tour, this.map);
    } else {
      trace = parseTrace(await fetch(this.base + "traces/" + which.replace(/[^\w.-]/g, "")).then((r) => r.text()));
    }
    this.emit({ type: "toast", text: `Replaying a ${trace.source} walk at ${speedup}x` });
    const samples = trace.samples;
    const t0 = Date.now();
    this.virtual = 0;
    let i = 0;
    const step = () => {
      this.virtual = (Date.now() - t0) * speedup;
      while (i < samples.length && samples[i].t <= this.virtual) {
        const x = samples[i++];
        if (x.lat != null) this.engine.location({ t: x.t, pos: { lat: x.lat, lon: x.lon }, accuracy: x.acc ?? 5, speed: x.speed ?? null });
        else if (x.heading != null) this.engine.heading(x.heading, x.t);
        else if (x.a != null) this.engine.motion(x.a, x.t);
      }
      this.changed();
      if (i < samples.length) requestAnimationFrame(step);
    };
    step();
  }

  saveRecording() {
    const blob = new Blob([JSON.stringify(this.recorder.file())], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `walk-${this.tour.id}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.json`;
    a.click();
  }
}

// The guidance shown when no scene is up: the same words on every device.
export function guidance(rt, { hasMap = true } = {}) {
  const st = rt.st, tour = rt.tour;
  const next = tour.stops.find((s) => s.id === st.nextId);
  let arrow = null, big = "", small = "";
  if (!next) {
    big = "Tour complete";
    small = "Head back to the start when you're ready.";
  } else if (!st.pos) {
    big = `Stop ${next.order}: ${next.name}`;
    small = st.error || "Waiting for GPS…";
  } else if (st.atStop) {
    const s = st.atStop;
    const t = targetBearing(s);
    if (st.heading == null) {
      big = s.facing.hint;
      small = `Face ${compassWord(t)}, toward ${s.facing.target_name}. No compass here: tap "Show scene".`;
    } else if (!st.facing && rt.engine.requireFacing) {
      const d = turn(st.heading, t);
      arrow = d;
      big = s.facing.hint;
      small = `Turn ${d > 0 ? "right" : "left"} about ${Math.abs(Math.round(d / 5) * 5)}°, toward ${s.facing.target_name}` +
        (st.headingSteady ? "" : ". Compass unsteady: if you are facing it, tap \"I'm facing it\".");
    } else {
      big = "Stand still for a moment";
      small = "The scene appears when you stop walking.";
    }
  } else {
    const d = distance(st.pos, next.position);
    const b = bearing(st.pos, next.position);
    arrow = st.heading == null ? null : turn(st.heading, b);
    big = `Stop ${next.order}: ${next.name}`;
    small = `${Math.round(d)} m ${st.heading == null ? compassWord(b) : "ahead"}${hasMap ? " · follow the bright line on the map" : ""}`;
  }
  return { arrow, big, small };
}
