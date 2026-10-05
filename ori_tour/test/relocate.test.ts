// Test-anywhere mode: the tour moved to a parking lot must keep its shape,
// fit the lot, put stop 1 ahead of the tester, and play end to end.

import { test } from "node:test";
import assert from "node:assert/strict";

import { bearing, distance, turn } from "../src/core/geo.ts";
import { relocate } from "../src/core/relocate.ts";
import { replay } from "../src/core/replay.ts";
import { syntheticWalk } from "../src/core/synthwalk.ts";
import { targetBearing } from "../src/core/tour.ts";
import { fallsPark } from "./helpers.ts";

const lot = { lat: 43.5446, lon: -96.7311 }; // an arbitrary spot in Sioux Falls, not the park

test("stops land around the tester, a parking lot apart", () => {
  const { tour } = fallsPark();
  const { tour: t } = relocate(tour, lot, { facingDeg: 30 });
  const pts = [t.start.position, ...t.stops.map((s) => s.position)];
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const d = distance(pts[i]!, pts[j]!);
      assert.ok(d >= 24, `points ${i},${j} only ${d.toFixed(1)} m apart`);
    }
  for (const s of t.stops)
    assert.ok(distance(lot, s.position) <= 71, `${s.id} is ${distance(lot, s.position).toFixed(0)} m away`);
  assert.equal(t.start.position.lat, lot.lat);
});

test("stop 1 is straight ahead of the way the tester faces", () => {
  const { tour } = fallsPark();
  for (const facing of [0, 75, 200, 330]) {
    const { tour: t } = relocate(tour, lot, { facingDeg: facing });
    const b = bearing(lot, t.stops[0]!.position);
    assert.ok(Math.abs(turn(facing, b)) < 1, `facing ${facing}, stop 1 at ${b.toFixed(1)}`);
  }
});

test("the layout keeps its shape: angles between stops and facings turn together", () => {
  const { tour } = fallsPark();
  const { tour: t, rotation } = relocate(tour, lot, { facingDeg: 123 });
  tour.stops.forEach((orig, i) => {
    const moved = t.stops[i]!;
    const want = (targetBearing(orig) + rotation) % 360;
    assert.ok(
      Math.abs(turn(targetBearing(moved), want)) <= 0.5,
      `${orig.id} faces ${targetBearing(moved)}, expected ${want}`,
    );
    const ob = bearing(tour.start.position, orig.position);
    const mb = bearing(lot, moved.position);
    assert.ok(Math.abs(turn(mb, (ob + rotation) % 360)) < 0.5);
  });
});

test("the relocated package says it is a test layout", () => {
  const { tour } = fallsPark();
  const { tour: t } = relocate(tour, lot, {});
  assert.match(t.title, /test layout/);
  assert.match(t.status, /TEST LAYOUT/);
  for (const s of t.stops) assert.match(s.placement, /relocated for testing/);
  // the original is untouched
  assert.doesNotMatch(tour.title, /test layout/);
});

test("a walk of the parking-lot layout plays every stop", () => {
  const { tour } = fallsPark();
  const { tour: t, map } = relocate(tour, lot, { facingDeg: 10 });
  const log = replay(t, syntheticWalk(t, map, { gpsErrM: 2.5, standS: 30 }));
  assert.deepEqual(
    log.events.filter((e) => e.type === "narrate").map((e) => e.stop),
    t.stops.map((s) => s.id),
  );
  assert.ok(log.done);
  assert.deepEqual(log.violations, []);
});
