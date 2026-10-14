import assert from "node:assert/strict";
import { test } from "node:test";

import type { TrackedFrame } from "../src/core/ports.ts";
import { DRAFT_FLAG, SceneCards, sceneCard } from "../src/core/scenecard.ts";
import { groundDist, rotate, toDeg, vec, yawOf, yawQuat, type Vec3 } from "../src/core/space.ts";
import { targetBearing } from "../src/core/tour.ts";
import { fallsPark } from "./helpers.ts";

const frame = (at: Vec3, yaw: number, quality: TrackedFrame["quality"] = "normal"): TrackedFrame => ({
  t: 0,
  viewer: { position: at, orientation: yawQuat(yaw) },
  quality,
  aim: null,
  anchors: new Map(),
});

const stop = (id: string) => fallsPark().tour.stops.find((s) => s.id === id)!;

test("every stop's scene becomes a card with the content's own words, and the draft flag", () => {
  const mill = sceneCard(stop("mill"));
  assert.equal(mill.title, "The Queen Bee Mill");
  assert.deepEqual(
    mill.rows.map((r) => r.lead),
    ["1856", "1881", "1883"],
  );
  const dakota = sceneCard(stop("dakota"));
  assert.equal(dakota.style, "quote");
  assert.match(dakota.credit ?? "", /Historical marker/);
  for (const s of fallsPark().tour.stops) {
    const c = sceneCard(s);
    assert.equal(c.flag, DRAFT_FLAG);
    assert.ok(c.rows.length > 0, `${s.id} has rows`);
  }
});

test("the card waits for the scene and good tracking, then stands where the visitor looked", () => {
  const cards = new SceneCards({ distanceM: 4, sideDeg: 0, liftM: 0 });
  const falls = stop("falls");
  const eye = vec(1, 1.6, 2);
  assert.equal(cards.update({ frame: frame(eye, 0), showing: null, at: falls, northYaw: null }), null);
  assert.equal(cards.update({ frame: frame(eye, 0, "limited"), showing: falls, at: falls, northYaw: null }), null);
  const v = cards.update({ frame: frame(eye, Math.PI / 2), showing: falls, at: falls, northYaw: null })!;
  assert.equal(v.aimedBy, "gaze");
  // yaw +90 degrees looks down -x
  assert.ok(Math.abs(v.pose.position.x - (1 - 4)) < 1e-9 && Math.abs(v.pose.position.z - 2) < 1e-9);
  // its readable face (+z) points back at the visitor
  const face = rotate(v.pose.orientation, vec(0, 0, 1));
  assert.ok(face.x > 0.99, `faces the visitor: ${JSON.stringify(face)}`);
});

test("it stays put: looking away or walking around does not move it, only turns it and hides it while walking", () => {
  const cards = new SceneCards({ sideDeg: 0 });
  const falls = stop("falls");
  const first = cards.update({ frame: frame(vec(0, 1.6, 0), 0), showing: falls, at: falls, northYaw: null })!;
  const p = first.pose.position;
  // the scene drops (the visitor walked a step) but they are still at the stop
  const later = cards.update({ frame: frame(vec(3, 1.6, -2), 2), showing: null, at: falls, northYaw: null })!;
  assert.deepEqual(later.pose.position, p);
  assert.equal(first.visible, true);
  assert.equal(later.visible, false, "pictures only when standing still");
  const back = cards.update({ frame: frame(vec(3, 1.6, -2), 2), showing: falls, at: falls, northYaw: null })!;
  assert.equal(back.visible, true);
  assert.deepEqual(back.pose.position, p, "back in the same spot");
  const face = rotate(later.pose.orientation, vec(0, 0, 1));
  const toViewer = { x: 3 - p.x, z: -2 - p.z };
  const n = Math.hypot(toViewer.x, toViewer.z);
  assert.ok(face.x * (toViewer.x / n) + face.z * (toViewer.z / n) > 0.999, "turned to the visitor");
});

test("once north is known it aims at the landmark, not the gaze, and stands to the side", () => {
  const cards = new SceneCards({ distanceM: 4, sideDeg: -25 });
  const mill = stop("mill");
  const northYaw = 0.7;
  const v = cards.update({ frame: frame(vec(0, 1.6, 0), 2.5), showing: mill, at: mill, northYaw })!;
  assert.equal(v.aimedBy, "landmark");
  const want = northYaw - (targetBearing(mill) * Math.PI) / 180 - (25 * Math.PI) / 180;
  const got = yawOf(yawQuat(Math.atan2(-v.pose.position.x, -v.pose.position.z)));
  assert.ok(Math.abs(toDeg(Math.atan2(Math.sin(got - want), Math.cos(got - want)))) < 1e-6);
  assert.ok(Math.abs(groundDist(vec(0, 0, 0), v.pose.position) - 4) < 1e-9);
});

test("leaving the stop takes the card down, and the next stop places its own", () => {
  const cards = new SceneCards();
  const falls = stop("falls");
  const mill = stop("mill");
  assert.ok(cards.update({ frame: frame(vec(0, 1.6, 0), 0), showing: falls, at: falls, northYaw: null }));
  assert.equal(cards.update({ frame: frame(vec(0, 1.6, -40), 0), showing: null, at: null, northYaw: null }), null);
  const v = cards.update({ frame: frame(vec(0, 1.6, -80), 0), showing: mill, at: mill, northYaw: null })!;
  assert.equal(v.card.stopId, "mill");
  assert.ok(v.pose.position.z < -80);
});
