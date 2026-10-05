// Headless tests for the tour core. No browser, no park:
//   cd ori_tour && npm test
// The synthetic walk is generated from the route geometry (see js/dev/synthwalk.js);
// a recorded walk dropped into content/<tour>/traces/ is replayed too.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateTour, prepareTour } from "../src/core/tour.ts";
import { HeadingFilter } from "../src/core/heading.ts";
import { StillnessDetector } from "../src/core/stillness.ts";
import { replay, parseTrace } from "../src/core/replay.ts";
import { offset, turn } from "../src/core/geo.ts";
import { syntheticWalk, toGpx } from "../src/core/synthwalk.ts";
import type { Tour, TourMap } from "../src/core/types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = join(ROOT, "content", "falls-park");
export const load = (): { tour: Tour; map: TourMap } =>
  prepareTour(
    JSON.parse(readFileSync(join(PKG, "tour.json"), "utf8")) as Tour,
    JSON.parse(readFileSync(join(PKG, "map.json"), "utf8")) as TourMap,
  );

test("the Falls Park package is valid", () => {
  const { tour } = load();
  assert.deepEqual(validateTour(tour), []);
});

test("generated narration audio matches the words it claims to speak", () => {
  const { tour } = load();
  for (const s of tour.stops) {
    const n = s.narration;
    if (!n.audio) continue;
    assert.ok(existsSync(join(PKG, n.audio)), `${s.id}: ${n.audio} missing`);
    assert.ok(n.cues && existsSync(join(PKG, n.cues)), `${s.id}: captions file missing`);
    const sha = createHash("sha256").update(n.text).digest("hex").slice(0, 16);
    assert.equal(
      n.text_sha,
      sha,
      `${s.id}: narration text changed since the audio was made; re-run tools/make_narration.py`,
    );
    const cues = JSON.parse(readFileSync(join(PKG, n.cues), "utf8")) as { text: string }[];
    assert.equal(
      cues.map((c) => c.text).join(" "),
      n.text.replace(/\s+/g, " ").trim(),
      `${s.id}: captions do not match the text`,
    );
  }
});

// ------------------------------------------------------------ heading

test("heading: a lone spike does not move it, a real turn does", () => {
  const f = new HeadingFilter();
  let t = 0;
  for (; t < 2000; t += 100) f.push(90, t);
  f.push(175, (t += 100)); // spike
  f.push(91, (t += 100));
  assert.ok(Math.abs(turn(f.value ?? NaN, 90)) < 2, `spike moved heading to ${f.value}`);
  // turn to 180 and hold
  for (let k = 0; k < 6; k++) f.push(180, (t += 100));
  assert.ok(Math.abs(turn(f.value ?? NaN, 180)) < 10, `turn not followed within 0.6 s: ${f.value}`);
});

test("heading: wraps through north without swinging through south", () => {
  const f = new HeadingFilter();
  let t = 0;
  for (let k = 0; k < 20; k++) f.push(k % 2 ? 358 : 2, (t += 100));
  assert.ok(Math.abs(turn(f.value ?? NaN, 0)) < 3, `got ${f.value}`);
});

test("heading: jitter is smoothed", () => {
  const f = new HeadingFilter();
  let t = 0,
    worst = 0;
  for (let k = 0; k < 100; k++) {
    f.push(200 + (k % 2 ? 6 : -6), (t += 100));
    if (k > 10) worst = Math.max(worst, Math.abs(turn(f.value ?? NaN, 200)));
  }
  assert.ok(worst < 3, `±6° jitter came through as ${worst.toFixed(1)}°`);
  assert.ok(f.steady());
});

// ------------------------------------------------------------ stillness

const here = { lat: 43.5574, lon: -96.7223 };

test("stillness: standing with a wandering GPS fix reads as still (no device speed, no accelerometer)", () => {
  const d = new StillnessDetector();
  // fixes scatter about 3 m around the true spot, correlated from one second to the next
  let seed = 5,
    n = 0,
    e = 0;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  for (let t = 0; t <= 20000; t += 1000) {
    n = n * 0.6 + r() * 6;
    e = e * 0.6 + r() * 6;
    d.gps({ t, pos: offset(offset(here, n, 0), e, 90), acc: 10, speed: null });
    if (t >= 6000) assert.equal(d.moving(), false, `read as walking at ${t} ms`);
  }
  assert.equal(d.moving(), false);
  assert.equal(d.still(20000), true);
});

test("stillness: walking at 1.3 m/s with a 5 m fix reads as walking from GPS alone", () => {
  const d = new StillnessDetector();
  for (let t = 0; t <= 12000; t += 1000) d.gps({ t, pos: offset(here, 1.3 * (t / 1000), 45), acc: 5, speed: null });
  assert.equal(d.moving(), true);
});

test("stillness: when fixes stop arriving (iOS does this standing still), the last speed does not stick", () => {
  const d = new StillnessDetector({ stillForS: 2 });
  for (let t = 0; t <= 6000; t += 1000) d.gps({ t, pos: offset(here, 1.4 * (t / 1000), 90), acc: 4, speed: 1.4 });
  assert.equal(d.moving(), true);
  assert.equal(d.still(8000), false);
  assert.equal(d.still(9500), false, "still before stale + dwell");
  assert.equal(d.still(11500), true, "the last walking speed stuck after fixes stopped");
});

test("stillness: footsteps read as walking within a second and a half, stopping takes the full dwell", () => {
  const d = new StillnessDetector({ stillForS: 2 });
  let t = 0;
  for (; t < 3000; t += 100) d.motion(t, 9.81 + 0.05 * Math.sin(t));
  assert.equal(d.still(t), true);
  const began = t;
  while (!d.moving()) {
    d.motion(t, 9.81 + 2 * Math.sin((t / 550) * 2 * Math.PI));
    t += 100;
  }
  assert.ok(t - began <= 1500, `walking took ${t - began} ms to notice`);
  for (const stop = t; t < stop + 3000; t += 100) d.motion(t, 9.81 + 2 * Math.sin((t / 550) * 2 * Math.PI));
  const stopped = t;
  while (!d.still(t)) {
    d.motion(t, 9.81);
    t += 100;
  }
  assert.ok(t - stopped >= 2000, `still after only ${t - stopped} ms`);
});

// ------------------------------------------------------------ replay

test("replay: the synthetic walk plays every stop in order, pictures only while still", () => {
  const { tour, map } = load();
  const log = replay(tour, syntheticWalk(tour, map));
  const narrated = log.events.filter((e) => e.type === "narrate").map((e) => e.stop);
  assert.deepEqual(
    narrated,
    tour.stops.map((s) => s.id),
  );
  assert.ok(log.done, "tour never completed");
  assert.deepEqual(log.violations, []);
});

test("replay: walking on before a stop's narration ends still completes the tour", () => {
  const { tour, map } = load();
  const slow = JSON.parse(JSON.stringify(tour)) as Tour;
  for (const st of slow.stops) st.narration.duration_s = 400; // longer than any walk between stops
  const log = replay(slow, syntheticWalk(slow, map), { tailMs: 500000 });
  assert.deepEqual(
    log.events.filter((e) => e.type === "narrate").map((e) => e.stop),
    slow.stops.map((s) => s.id),
  );
  assert.ok(log.done);
});

test("replay: facing away keeps the scene down until the walker turns", () => {
  const { tour, map } = load();
  const trace = syntheticWalk(tour, map, { wrongWay: ["dakota"], wrongWayS: 12, seed: 11 });
  const log = replay(tour, trace);
  const dakota = log.events.find((e) => e.type === "narrate" && e.stop === "dakota");
  assert.ok(dakota, "dakota never played");
  // the walker stood facing away for 12 s; it must not have played in that window
  const doneFalls = log.events.find((e) => e.type === "stop-done" && e.stop === "falls");
  assert.ok(doneFalls && dakota.t - doneFalls.t > 12000 - 1, "scene showed while facing away");
  assert.deepEqual(log.violations, []);
});

test("replay: walking straight past a stop does not trigger it", () => {
  const { tour, map } = load();
  const trace = syntheticWalk(tour, map, { standS: 1 });
  // footsteps the whole way: the walker pauses a moment at each stop but never stands
  const walkOnly = {
    ...trace,
    samples: trace.samples.map((x) => ("a" in x ? { ...x, a: 9.81 + 2 * Math.sin(x.t / 87) } : x)),
  };
  const log = replay(tour, walkOnly, { tailMs: 0 });
  assert.equal(log.events.filter((e) => e.type === "narrate").length, 0);
});

test("replay: a GPX from a phone logger app replays (arrival and standing; facing assumed)", () => {
  const { tour, map } = load();
  const gpx = toGpx(syntheticWalk(tour, map, { seed: 3 }));
  const trace = parseTrace(gpx);
  assert.equal(trace.headingless, true);
  const log = replay(tour, trace);
  assert.deepEqual(
    log.events.filter((e) => e.type === "narrate").map((e) => e.stop),
    tour.stops.map((s) => s.id),
  );
  assert.deepEqual(log.violations, []);
});

test("replay: every recorded walk in the package still plays through", () => {
  const dir = join(PKG, "traces");
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((n) => /\.(json|gpx)$/.test(n))) {
    const { tour } = load();
    const log = replay(tour, parseTrace(readFileSync(join(dir, f), "utf8")));
    assert.deepEqual(log.violations, [], f);
    assert.ok(log.visited.length > 0, `${f}: no stop triggered`);
  }
});

// ------------------------------------------------------------ offline bundle

test("offline.json lists every file the app loads, and is current", async () => {
  const list = JSON.parse(readFileSync(join(ROOT, "offline.json"), "utf8")) as { version: string; files: string[] };
  const listed = new Set(list.files);
  for (const f of list.files) if (f !== "./") assert.ok(existsSync(join(ROOT, f)), `offline.json lists missing ${f}`);
  // every module the app imports, every asset the package names
  const walk = (d: string): string[] =>
    readdirSync(join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`],
    );
  for (const f of walk("dist")) assert.ok(listed.has(f), `${f} is not cached for offline use; run npm run build`);
  const { tour } = load();
  for (const s of tour.stops) {
    for (const p of [s.narration.audio, s.narration.cues, s.scene.image])
      if (p) assert.ok(listed.has(`content/falls-park/${p}`), `${p} not cached offline`);
  }
  const { execFileSync } = await import("node:child_process");
  const fresh = execFileSync(
    "python3",
    ["-c", "import sys,json;sys.path.insert(0,'tools');import build_offline as b;print(b.build()['version'])"],
    { cwd: ROOT },
  )
    .toString()
    .trim();
  assert.equal(list.version, fresh, "offline.json is stale; run tools/build_offline.py");
});
