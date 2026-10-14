import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import {
  catchUp,
  conflicts,
  encounters,
  estimateOffset,
  plan,
  playheadAt,
  positionAt,
  Route,
  schedule,
  segmentFromCues,
  speakingAt,
  tourRoute,
  type Group,
  type Segment,
} from "../src/core/groupaudio.ts";
import type { CaptionCue } from "../src/core/types.ts";
import { fallsPark, PKG, readJson } from "./helpers.ts";

const cues = (id: string): CaptionCue[] => readJson<CaptionCue[]>(join(PKG, "audio", `${id}.cues.json`));

/** A straight 200 m path with one stop at 100 m. */
const line = new Route([
  { x: 0, y: 0 },
  { x: 200, y: 0 },
]);
const talk: Segment = segmentFromCues("talk", [
  { start: 0, end: 6, text: "One." },
  { start: 6.5, end: 12, text: "Two." },
  { start: 12.5, end: 20, text: "Three." },
]);
const group = (id: string, startAt: number, speed = 1.2, seg = talk): Group => ({
  id,
  route: line,
  speedMps: speed,
  startAt,
  startS: 0,
  spreadM: 1.5,
  stops: [{ stopId: "stop", routeS: 100, segment: seg, settleS: 3, lingerS: 5 }],
});

test("a segment from the real captions: one span per sentence, the first key, nothing optional, a flex point before each", () => {
  const seg = segmentFromCues("mill", cues("mill"));
  assert.equal(seg.speech.length, cues("mill").length);
  assert.ok(seg.speech[0]!.key && seg.speech.slice(1).every((s) => !s.key));
  assert.ok(
    seg.speech.every((s) => !s.optional),
    "only an author may mark a sentence optional",
  );
  assert.deepEqual(
    seg.flex.map((f) => f.at),
    cues("mill").map((c) => c.start),
  );
  assert.equal(seg.durationS, cues("mill").at(-1)!.end);
});

test("a route measures along its line, and projects a point onto it", () => {
  const r = new Route([
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 40 },
  ]);
  assert.equal(r.length, 70);
  assert.deepEqual(r.at(50), { x: 30, y: 20 });
  assert.ok(Math.abs(r.project({ x: 33, y: 10 }) - 40) < 1e-9);
  assert.deepEqual(r.at(999), { x: 30, y: 40 });
});

test("a group walks, settles, speaks its sentences, lingers and walks on", () => {
  const sc = schedule(group("A", 0));
  const arrive = 100 / 1.2;
  assert.ok(Math.abs(sc.speech[0]!.start - (arrive + 3)) < 1e-9);
  assert.equal(sc.speech.length, 3);
  assert.ok(speakingAt(sc, arrive + 4) && !speakingAt(sc, arrive + 3 + 6.2));
  assert.deepEqual(positionAt(sc, arrive / 2), { x: 50, y: 0 });
  assert.deepEqual(positionAt(sc, arrive + 10), { x: 100, y: 0 });
});

test("a hold at a flex point delays the rest of that narration and the group's leaving, not what came before", () => {
  const base = schedule(group("A", 0));
  const held = schedule(group("A", 0), [
    { group: "A", segment: "talk", at: 6.5, action: "hold", seconds: 4, prompt: "look" },
  ]);
  assert.equal(held.speech[0]!.start, base.speech[0]!.start);
  assert.ok(Math.abs(held.speech[1]!.start - base.speech[1]!.start - 4) < 1e-9);
  assert.ok(Math.abs(held.narrations[0]!.end - base.narrations[0]!.end - 4) < 1e-9);
  // a hold for another group changes nothing here
  const other = schedule(group("A", 0), [
    { group: "B", segment: "talk", at: 6.5, action: "hold", seconds: 4, prompt: "" },
  ]);
  assert.deepEqual(other.speech, base.speech);
});

test("only a sentence an author marked optional can be skipped, and never a key one", () => {
  const seg: Segment = { ...talk, speech: talk.speech.map((s, i) => ({ ...s, optional: i === 1 })) };
  const skipped = schedule(group("A", 0, 1.2, seg), [
    { group: "A", segment: "talk", at: 6.5, action: "skip", seconds: 5.5, prompt: "1" },
  ]);
  assert.equal(skipped.speech.length, 2);
  const notOptional = schedule(group("A", 0), [
    { group: "A", segment: "talk", at: 6.5, action: "skip", seconds: 5.5, prompt: "1" },
  ]);
  assert.equal(notOptional.speech.length, 3);
});

test("encounters are found and named: two groups at one stop, an overtake, a head-on pass", () => {
  const shared = encounters([schedule(group("A", 0)), schedule(group("B", 10))]);
  assert.ok(shared.some((e) => e.kind === "shared-stop"));
  // a fast group catches a slow one on the path
  const slow = group("slow", 0, 0.8);
  slow.stops = [];
  const fast = group("fast", 20, 1.6);
  fast.stops = [];
  const pass = encounters([schedule(slow), schedule(fast)]);
  assert.ok(pass.some((e) => e.kind === "overtake"));
  // two groups walking towards each other
  const back: Group = { ...group("back", 0), route: new Route([...line.points].reverse()), stops: [] };
  const fwd = group("fwd", 0);
  fwd.stops = [];
  assert.ok(encounters([schedule(fwd), schedule(back)]).some((e) => e.kind === "head-on"));
});

test("two groups at one stop would talk over each other; the plan holds one so their speech never overlaps while close", () => {
  const groups = [group("A", 0), group("B", 8)];
  const p = plan(groups);
  assert.ok(p.before.length > 0, "without coordination they overlap");
  assert.ok(p.adjustments.length > 0);
  assert.deepEqual(p.ducks, []);
  const after = conflicts(groups.map((g) => schedule(g, p.adjustments)));
  assert.deepEqual(after, []);
  // every hold is at a real flex point and within what it allows
  for (const a of p.adjustments) {
    const f = talk.flex.find((x) => x.at === a.at)!;
    assert.ok(a.action === "hold" && a.seconds <= f.maxHoldS + 1e-9);
  }
  // the plan is the same on every device that computes it
  assert.deepEqual(plan(groups), p);
});

test("the plan is cheap: it does not hold more than the overlapping speech needs", () => {
  const groups = [group("A", 0), group("B", 8)];
  const p = plan(groups);
  const speechA = talk.speech.reduce((s, x) => s + x.end - x.start, 0);
  assert.ok(p.addedS <= talk.durationS + 2, `${p.addedS} s added for a ${speechA} s narration`);
});

test("groups that never come near each other are left alone", () => {
  const far: Group = {
    ...group("far", 0),
    route: new Route([
      { x: 0, y: 500 },
      { x: 200, y: 500 },
    ]),
  };
  const p = plan([group("A", 0), far]);
  assert.deepEqual(p.before, []);
  assert.deepEqual(p.adjustments, []);
});

test("with no room at any flex point, the overlap goes to the devices as a duck interval instead", () => {
  const rigid: Segment = { ...talk, flex: talk.flex.map((f) => ({ ...f, maxHoldS: 0 })) };
  const p = plan([group("A", 0, 1.2, rigid), group("B", 8, 1.2, rigid)]);
  assert.deepEqual(p.adjustments, []);
  assert.ok(p.ducks.length > 0);
});

test("nothing before now is changed", () => {
  const groups = [group("A", 0), group("B", 8)];
  const now = schedule(groups[1]!).speech[0]!.start + 1; // B is already speaking
  const p = plan(groups, { now });
  for (const a of p.adjustments) {
    const sc = schedule(groups.find((g) => g.id === a.group)!);
    const f = sc.narrations[0]!.flexAt.find((x) => x.flex.at === a.at)!;
    assert.ok(f.t >= now - 1e-9, "a hold is never placed in the past");
  }
});

test("on the real Falls Park route, two groups a minute apart: overlaps found, all cleared by holds", () => {
  const { tour, map } = fallsPark();
  const { route, stopS } = tourRoute(map, tour.stops);
  assert.ok(Math.abs(route.length - map.legs.reduce((s, l) => s + l.metres, 0)) < 40);
  const stops = [...tour.stops]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      stopId: s.id,
      routeS: stopS.get(s.id)!,
      segment: segmentFromCues(s.id, cues(s.id)),
      settleS: 4,
      lingerS: 20,
    }));
  assert.ok(
    stops.every((s, i) => i === 0 || s.routeS > stops[i - 1]!.routeS),
    "stops in order along the route",
  );
  const g = (id: string, startAt: number, speed: number): Group => ({
    id,
    route,
    speedMps: speed,
    startAt,
    startS: 0,
    spreadM: 2,
    stops,
  });
  const groups = [g("slow", 0, 0.9), g("fast", 60, 1.4)];
  const p = plan(groups, { horizonS: 1200, stepS: 0.5 });
  assert.ok(p.before.length > 0);
  assert.deepEqual(
    conflicts(
      groups.map((x) => schedule(x, p.adjustments)),
      { horizonS: 1200, stepS: 0.5 },
    ),
    [],
  );
  assert.deepEqual(p.ducks, []);
});

test("every device of a group computes the same playhead from the shared clock, including the silent prompt in a hold", () => {
  const adj = [
    { group: "A", segment: "talk", at: 6.5, action: "hold" as const, seconds: 4, prompt: "Look up at the mill roof" },
  ];
  const seg: Segment = { ...talk, flex: talk.flex.map((f) => ({ ...f, prompt: "Look up at the mill roof" })) };
  const sc = schedule(group("A", 0, 1.2, seg), adj);
  const n = sc.narrations[0]!;
  assert.deepEqual(playheadAt(sc, n.start + 2), { stopId: "stop", segment: "talk", contentS: 2, holding: null });
  const reach = n.flexAt.find((f) => f.flex.at === 6.5)!.t;
  assert.equal(playheadAt(sc, reach + 1)?.holding, "Look up at the mill roof");
  assert.ok(Math.abs(playheadAt(sc, reach + 4 + 1)!.contentS - 7.5) < 1e-9);
  assert.equal(playheadAt(sc, n.start - 1), null);
});

test("clock offset comes from the fastest exchange; a device catches up by a small rate change, or jumps when far out", () => {
  const est = estimateOffset([
    { sentMs: 1000, refMs: 5060, receivedMs: 1100 }, // slow: 100 ms round trip
    { sentMs: 2000, refMs: 6010, receivedMs: 2020 }, // fast: 20 ms
  ]);
  assert.deepEqual(est, { offsetMs: 4000, rttMs: 20 });
  assert.equal(estimateOffset([]), null);
  const near = catchUp(10.0, 10.02);
  assert.ok(near.rate > 1 && near.rate <= 1.03 && near.seekTo === null);
  assert.ok(catchUp(10.02, 10.0).rate < 1);
  assert.deepEqual(catchUp(10, 11), { rate: 1, seekTo: 11 });
});
