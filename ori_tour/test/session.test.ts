// TourSession with fake, non-browser ports: proof that the core runs on
// anything that implements src/core/ports.ts, and a spec for new ports.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { AudioPort, Display, LocationReading, Scheduler } from "../src/core/ports.ts";
import { TourSession } from "../src/core/session.ts";
import { targetBearing } from "../src/core/tour.ts";
import type { Narration } from "../src/core/types.ts";
import type { ViewModel } from "../src/core/view.ts";
import { fallsPark } from "./helpers.ts";

function harness() {
  let now = 0;
  const ticks: (() => void)[] = [];
  const scheduler: Scheduler = {
    every: (_ms, fn) => {
      ticks.push(fn);
      return () => ticks.splice(ticks.indexOf(fn), 1);
    },
  };
  const played: string[] = [];
  let finish: (() => void) | null = null;
  const audio: AudioPort = {
    muted: false,
    play: (n: Narration, onCaption, onEnd) => {
      played.push(n.text.slice(0, 20));
      onCaption(n.text.split(".")[0] ?? "");
      finish = onEnd;
    },
    stop: () => (finish = null),
  };
  const views: ViewModel[] = [];
  const notes: string[] = [];
  const display: Display = { render: (v) => views.push(v), notify: (t) => notes.push(t) };
  let loc: ((r: LocationReading) => void) | null = null;
  let head: ((d: number, t: number) => void) | null = null;
  const advance = (ms: number): void => {
    for (let i = 0; i < ms; i += 250) {
      now += 250;
      ticks.forEach((f) => f());
    }
  };
  return {
    clock: { now: () => now },
    scheduler,
    audio,
    display,
    played,
    views,
    notes,
    advance,
    endNarration: () => finish?.(),
    sources: {
      location: { start: (s: (r: LocationReading) => void) => ((loc = s), () => (loc = null)) },
      heading: { start: (s: (d: number, t: number) => void) => ((head = s), () => (head = null)) },
    },
    stand: (pos: { lat: number; lon: number }, facing: number) => {
      loc?.({ t: now, pos, accuracy: 4, speed: 0 });
      head?.(facing, now);
    },
  };
}

test("a session plays a stop through any ports: arrive, face, stand, narrate, finish", async () => {
  const { tour } = fallsPark();
  const h = harness();
  const s = new TourSession(tour, { clock: h.clock, scheduler: h.scheduler, audio: h.audio, display: h.display });
  await s.start(h.sources);
  const stop = tour.stops[0]!;
  h.stand(stop.position, (targetBearing(stop) + 90) % 360); // facing away
  h.advance(4000);
  assert.equal(h.played.length, 0, "played while facing away");
  assert.equal(h.views.at(-1)?.mode, "guide");
  for (let k = 0; k < 6; k++) {
    h.stand(stop.position, targetBearing(stop));
    h.advance(500);
  }
  h.advance(3000);
  assert.equal(h.played.length, 1);
  const v = h.views.at(-1)!;
  assert.equal(v.mode, "scene");
  assert.equal(v.scene?.id, stop.id);
  assert.ok(v.caption.length > 0, "caption not passed to the display");
  h.endNarration();
  assert.ok(s.engine.state.visited.has(stop.id));
  assert.match(h.notes.at(-1) ?? "", /Stop 1 done/);
  s.stop();
});

test("a device with no compass runs with requireFacing off", async () => {
  const { tour } = fallsPark();
  const h = harness();
  const s = new TourSession(
    tour,
    { clock: h.clock, scheduler: h.scheduler, audio: h.audio, display: h.display },
    { requireFacing: false, hasMap: false },
  );
  await s.start({ location: h.sources.location });
  const stop = tour.stops[0]!;
  for (let k = 0; k < 8; k++) {
    h.advance(500);
    s.engine.location({ t: h.clock.now(), pos: stop.position, accuracy: 4, speed: 0 });
  }
  assert.equal(h.played.length, 1);
  assert.doesNotMatch(h.views.at(-1)?.guide.detail ?? "", /map/);
});
