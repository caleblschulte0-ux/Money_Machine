// Test mode, headless: spawn a figure where the phone aims, save the spot as a
// test point, walk away, come back (even after a reload) and it comes back
// near the same place on its own. Plus the ground rules that keep a figure
// off walls and off one odd hit.

import assert from "node:assert/strict";
import { test } from "node:test";

import { isLevel } from "../src/core/anchoring.ts";
import type { Storage } from "../src/core/ports.ts";
import { groundDist, vec, yawQuat, type Vec3 } from "../src/core/space.ts";
import { TEST_POINTS_SCHEMA, TestPoints } from "../src/core/testpoints.ts";
import { siteAt, stopFigureId, TourFigures, type TourFiguresView } from "../src/core/tourfigures.ts";
import { FakeWorld, geo, world } from "./fakeworld.ts";

const memory = (): Storage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
};
const settle = (): Promise<void> => new Promise((r) => setImmediate(r));

function rig(points: TestPoints, w = new FakeWorld()): { w: FakeWorld; figures: TourFigures } {
  w.drift = { position: vec(-2, 0.1, 4), orientation: yawQuat(-0.6) };
  return { w, figures: new TourFigures(w, points.sites(), { freeSpawn: true, settleMs: 0 }) };
}

function step(w: FakeWorld, figures: TourFigures, sites: TestPoints, aim: number | null = 5): TourFiguresView {
  const pos = geo(world(w.fix()));
  return figures.update({
    frame: w.tracked(aim),
    fix: { pos, accuracy: 4 },
    heading: w.heading(),
    headingSteady: true,
    at: siteAt(sites.sites(), pos),
  });
}

async function frames(w: FakeWorld, f: TourFigures, p: TestPoints, n: number): Promise<TourFiguresView> {
  let v = step(w, f, p);
  for (let i = 0; i < n; i++) {
    v = step(w, f, p);
    await settle();
  }
  return v;
}

test("Spawn here puts the picked figure where the phone aims, at true size; spawning again moves it", async () => {
  const points = new TestPoints(memory());
  const { w, figures } = rig(points);
  w.standAt(vec(0, 0, 0), vec(0, 0, -10));
  await frames(w, figures, points, 10);
  assert.equal(await figures.spawn("mammoth"), true);
  let v = await frames(w, figures, points, 3);
  const m = v.stage.figures.find((f) => f.id === "mammoth")!;
  assert.equal(m.model, "mammoth");
  assert.equal(m.scale, 1);
  const first = w.inWorld(m.pose);
  w.standAt(vec(0, 0, 0), vec(10, 0, 0));
  await frames(w, figures, points, 3);
  await figures.spawn("mammoth");
  v = await frames(w, figures, points, 3);
  assert.equal(v.stage.figures.length, 1, "moved, not duplicated");
  assert.ok(groundDist(w.inWorld(v.stage.figures[0]!.pose), first) > 5);
});

test("a saved test point brings its figure back near the same spot after walking away and after a reload", async () => {
  const storage = memory();
  let points = new TestPoints(storage);
  const { w, figures } = rig(points);
  const spot = vec(5, 0, 5);
  w.standAt(spot, vec(5, 0, -5));
  await frames(w, figures, points, 30);
  await figures.spawn("settler");
  let v = await frames(w, figures, points, 3);
  const placed = w.inWorld(v.stage.figures.find((f) => f.id === "settler")!.pose);
  const viewer = w.tracked(5).viewer!.position;
  const rel = figures.capture("settler", viewer)!;
  assert.ok(rel, "north learned, so the figure can be put on the map");
  points.add({
    position: geo(world(w.fix())),
    figure: { model: "settler", scale: 1, ...rel },
    facingDeg: w.heading(),
    savedAt: 0,
  });
  assert.match(storage.data.get("ori-test-points")!, new RegExp(TEST_POINTS_SCHEMA.replace(".", "\\.")));

  // reload: everything rebuilt from storage, a new tracking space
  points = new TestPoints(storage);
  assert.equal(points.list().length, 1);
  const again = rig(points, w);
  w.drift = { position: vec(7, 0, -3), orientation: yawQuat(1.1) };
  w.standAt(vec(60, 0, 60), spot); // far away first
  v = await frames(w, again.figures, points, 5);
  assert.equal(v.mode, "none");
  w.standAt(spot, vec(5, 0, -5)); // walk back
  v = await frames(w, again.figures, points, 40);
  assert.equal(v.mode, "standing");
  const back = w.inWorld(v.stage.figures.find((f) => f.id === stopFigureId(points.list()[0]!))!.pose);
  assert.ok(groundDist(back, placed) < 0.5, `back within 50 cm (${groundDist(back, placed).toFixed(2)} m)`);
});

test("test points can be removed and cleared, and bad stored data is dropped with a reason", () => {
  const storage = memory();
  const points = new TestPoints(storage);
  const base = { position: { lat: 43.5, lon: -96.7 }, facingDeg: 0, savedAt: 1 };
  const a = points.add({ ...base, figure: { model: "mammoth", scale: 1, offset_m: 6, bearing_deg: 10, yaw_deg: 90 } });
  points.add({ ...base, figure: { model: "settler", scale: 1, offset_m: 3, bearing_deg: null, yaw_deg: 0 } });
  points.remove(a.id);
  assert.deepEqual(
    new TestPoints(storage).list().map((p) => p.figure.model),
    ["settler"],
  );
  assert.throws(() =>
    points.add({ ...base, figure: { model: "unicorn", scale: 1, offset_m: 3, bearing_deg: 0, yaw_deg: 0 } }),
  );
  points.clear();
  assert.equal(new TestPoints(storage).list().length, 0);

  storage.set("ori-test-points", "{nope");
  assert.match(new TestPoints(storage).loadProblems[0]!, /not JSON/);
  storage.set("ori-test-points", JSON.stringify({ schema: TEST_POINTS_SCHEMA, points: [{ id: "x" }] }));
  const bad = new TestPoints(storage);
  assert.equal(bad.list().length, 0);
  assert.ok(bad.loadProblems.length > 0);
});

test("a figure never stands on a wall, and one odd ground hit does not lift it", async () => {
  const level = { position: vec(0, 0, 0), orientation: { x: 0, y: 0, z: 0, w: 1 } };
  const wall = { position: vec(0, 1, 0), orientation: { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 } };
  assert.equal(isLevel(level), true);
  assert.equal(isLevel(wall), false);

  const points = new TestPoints(memory());
  const { w, figures } = rig(points);
  w.standAt(vec(0, 0, 0), vec(0, 0, -10));
  await frames(w, figures, points, 20);
  const ground: Vec3 = vec(0, 0, 0);
  const y0 = figures.groundY()!;
  assert.ok(y0 != null);
  // one hit on a car bonnet, 0.9 m up
  w.drift = { ...w.drift, position: vec(w.drift.position.x, w.drift.position.y + 0.9, w.drift.position.z) };
  step(w, figures, points);
  w.drift = { ...w.drift, position: vec(w.drift.position.x, w.drift.position.y - 0.9, w.drift.position.z) };
  assert.equal(figures.groundY(), y0, `ground stays at ${ground.y}`);
});
