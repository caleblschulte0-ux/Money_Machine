// Figures inside the tour, headless: the Falls Park package moved into a
// (simulated) parking lot, a visitor walking it, a tracker whose space is
// turned and shifted away from the world, and a compass and GPS reading the
// truth. Checks that each stop's figure appears near its spot without a tap,
// on the ground, stays put, is gone between stops, comes back after a lost
// anchor, and survives a reload where anchors can persist.

import assert from "node:assert/strict";
import { test } from "node:test";

import { figureById } from "../src/core/figures.ts";
import { distance } from "../src/core/geo.ts";
import type { Storage } from "../src/core/ports.ts";
import { relocate } from "../src/core/relocate.ts";
import { groundDist, vec, yawQuat, type Vec3 } from "../src/core/space.ts";
import { figurePosition } from "../src/core/tour.ts";
import { stopFigureId, TourFigures, type TourFiguresView } from "../src/core/tourfigures.ts";
import type { Stop, Tour } from "../src/core/types.ts";
import { FakeWorld, geo as geoOf, ORIGIN, world } from "./fakeworld.ts";
import { fallsPark } from "./helpers.ts";

/** The real package, moved around ORIGIN with stop 1 due north. */
function lotTour(): Tour {
  return relocate(fallsPark().tour, ORIGIN, { facingDeg: 0 }).tour;
}

const memory = (): Storage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
};

interface Walk {
  world: FakeWorld;
  figures: TourFigures;
  tour: Tour;
  /** compass error, degrees; GPS error, metres east */
  compassErr: number;
  gpsErrEast: number;
  accuracy: number;
  aim: number | null;
}

function step(w: Walk): TourFiguresView {
  const f = w.world.tracked(w.aim);
  const fix = world(w.world.fix());
  const noisy = { x: fix.x + w.gpsErrEast, y: 0, z: fix.z };
  const pos = geoOf(noisy);
  const atStop = w.tour.stops.find((s) => distance(pos, s.position) <= s.radius_m) ?? null;
  return w.figures.update({
    frame: f,
    fix: { pos, accuracy: w.accuracy },
    heading: (w.world.heading() + w.compassErr + 360) % 360,
    headingSteady: true,
    atStop,
  });
}

const settle = (): Promise<void> => new Promise((r) => setImmediate(r));

function setup(opts: Partial<Walk> = {}, storage?: Storage, persist = false): Walk {
  const tour = opts.tour ?? lotTour();
  const w = opts.world ?? new FakeWorld();
  w.canPersist = persist;
  // tracking space turned 25 degrees and shifted from the world: nothing lines up by accident
  w.drift = { position: vec(3, 0.2, -1), orientation: yawQuat((25 * Math.PI) / 180) };
  return {
    world: w,
    tour,
    figures: new TourFigures(w, tour, { storage }),
    compassErr: 0,
    gpsErrEast: 0,
    accuracy: 5,
    aim: 4,
    ...opts,
  };
}

/** Stand at a stop facing its figure's spot, for n frames. */
async function standAt(w: Walk, stop: Stop, n = 40): Promise<TourFiguresView> {
  const spot = world(figurePosition(stop, stop.figure!));
  w.world.standAt(world(stop.position), spot);
  let v = step(w);
  for (let i = 0; i < n; i++) {
    v = step(w);
    await settle();
  }
  return v;
}

const figureInWorld = (w: Walk, v: TourFiguresView, stop: Stop): Vec3 | null => {
  const f = v.stage.figures.find((x) => x.id === stopFigureId(stop));
  return f ? w.world.inWorld(f.pose) : null;
};

test("the package gives the falls a mammoth and the mill a settler; the Dakota stop has none until Dakota advisers say", () => {
  const tour = lotTour();
  const byId = Object.fromEntries(tour.stops.map((s) => [s.id, s]));
  assert.equal(byId.falls?.figure?.model, "mammoth");
  assert.equal(byId.mill?.figure?.model, "settler");
  assert.equal(byId.dakota?.figure ?? null, null);
  for (const s of tour.stops) if (s.figure) assert.ok(s.figure.note.length > 20, `${s.id}: figure note`);
});

test("arriving at a stop puts its figure on the ground at its spot, without a tap", async () => {
  const w = setup();
  const falls = w.tour.stops.find((s) => s.id === "falls")!;
  const v = await standAt(w, falls);
  assert.equal(v.mode, "standing");
  assert.equal(v.stopId, "falls");
  const at = figureInWorld(w, v, falls)!;
  const want = world(figurePosition(falls, falls.figure!));
  assert.ok(groundDist(at, want) < 0.3, `within 30 cm of its spot (${groundDist(at, want).toFixed(2)} m)`);
  assert.ok(Math.abs(at.y) < 1e-6, "standing on the ground");
  assert.equal(v.stage.figures[0]?.model, "mammoth");
});

test("with a 6 degree compass error and 4 m of GPS error it still lands near its spot, then never moves", async () => {
  const w = setup({ compassErr: 6, gpsErrEast: 4 });
  const falls = w.tour.stops.find((s) => s.id === "falls")!;
  let v = await standAt(w, falls);
  const first = figureInWorld(w, v, falls)!;
  const want = world(figurePosition(falls, falls.figure!));
  const off = groundDist(first, want);
  assert.ok(off < 4 + 9 * Math.sin((6 * Math.PI) / 180) + 0.3, `near its spot (${off.toFixed(2)} m off)`);

  // walk a circle around it while GPS keeps wandering: it stays where it landed
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * 2.2 * Math.PI;
    w.gpsErrEast = 4 * Math.cos(i / 7);
    w.world.standAt(vec(first.x + 7 * Math.sin(a), 0, first.z + 7 * Math.cos(a)), first);
    v = step(w);
    assert.ok(groundDist(figureInWorld(w, v, falls)!, first) < 0.01);
  }
  assert.ok(v.stage.figures[0]!.aroundDeg >= 350);
});

test("it waits for the ground, a usable fix and a steady compass, and says which", async () => {
  const w = setup({ aim: null });
  const falls = w.tour.stops.find((s) => s.id === "falls")!;
  let v = await standAt(w, falls, 5);
  assert.equal(v.mode, "waiting");
  assert.equal(v.waitingFor, "the ground");
  assert.match(v.prompt!, /mammoth is about to appear/);

  w.aim = 4;
  w.accuracy = 35;
  v = await standAt(w, falls, 5);
  assert.equal(v.waitingFor, "GPS (±35 m)");
});

test("when auto placement cannot happen, it asks for a tap, and the tap places it", async () => {
  const w = setup({ accuracy: 40 });
  const falls = w.tour.stops.find((s) => s.id === "falls")!;
  let v = await standAt(w, falls, 400); // 400 frames of 33 ms: past the 12 s wait
  assert.equal(v.mode, "tap");
  assert.match(v.prompt!, /Tap the ground to place the mammoth/);
  assert.equal(await w.figures.tap(), true);
  await settle();
  v = step(w);
  assert.equal(v.mode, "standing");
  assert.ok(
    Math.abs(
      groundDist(world(falls.position), figureInWorld(w, v, falls)!) - (figureById("mammoth")!.footprintM + 1.5),
    ) < 0.01,
    "on the aimed ground, pushed clear",
  );
});

test("between stops there is no figure: walking well away takes it down", async () => {
  const w = setup();
  const falls = w.tour.stops.find((s) => s.id === "falls")!;
  await standAt(w, falls);
  // walk 60 m south of the stop
  w.world.standAt(vec(world(falls.position).x, 0, world(falls.position).z + 60), world(falls.position));
  const v = step(w);
  assert.equal(v.mode, "none");
  assert.equal(v.stage.figures.length, 0);
  assert.equal(v.prompt, null);
});

test("an anchor the platform loses is replaced from the stop's position", async () => {
  const w = setup();
  const falls = w.tour.stops.find((s) => s.id === "falls")!;
  let v = await standAt(w, falls);
  const id = v.stage.figures[0]!.anchorId!;
  w.world.dropAnchor(id);
  for (let i = 0; i < 160; i++) {
    v = step(w); // 5 s of frames
    await settle();
  }
  assert.equal(v.mode, "standing");
  assert.notEqual(v.stage.figures[0]!.anchorId, id, "a new anchor");
  const want = world(figurePosition(falls, falls.figure!));
  assert.ok(groundDist(figureInWorld(w, v, falls)!, want) < 0.3);
});

test("where anchors persist, a reload brings the figure back exactly where it stood", async () => {
  const storage = memory();
  const w = setup({ compassErr: 5, gpsErrEast: 3 }, storage, true);
  const falls = w.tour.stops.find((s) => s.id === "falls")!;
  const v = await standAt(w, falls);
  const before = figureInWorld(w, v, falls)!;
  assert.equal(storage.data.size, 1, "handle stored");

  // reload: a new session, a new tracking space, different compass error
  const again = setup({ world: w.world, compassErr: -4, gpsErrEast: -2 }, storage, true);
  w.world.drift = { position: vec(-5, 0, 2), orientation: yawQuat(-0.4) };
  const v2 = await standAt(again, falls);
  assert.equal(v2.mode, "standing");
  assert.ok(groundDist(figureInWorld(again, v2, falls)!, before) < 0.01, "same spot, not re-guessed from GPS");
});

test("where anchors do not persist, a reload re-places the figure from the stop's position", async () => {
  const storage = memory();
  const w = setup({}, storage, false);
  const falls = w.tour.stops.find((s) => s.id === "falls")!;
  await standAt(w, falls);
  assert.equal(storage.data.size, 0, "nothing to store");
  const again = setup({ world: w.world }, storage, false);
  const v = await standAt(again, falls);
  assert.equal(v.mode, "standing");
  assert.ok(groundDist(figureInWorld(again, v, falls)!, world(figurePosition(falls, falls.figure!))) < 0.3);
});

test("the next stop's figure replaces the last one; the Dakota stop shows none", async () => {
  const w = setup();
  const [falls, dakota, mill] = ["falls", "dakota", "mill"].map((id) => w.tour.stops.find((s) => s.id === id)!);
  await standAt(w, falls!);
  w.world.standAt(world(dakota!.position), world(mill!.position));
  let v = step(w);
  for (let i = 0; i < 5; i++) v = step(w);
  assert.equal(v.mode, "none", "falls figure taken down well away from it; none at the Dakota stop");
  v = await standAt(w, mill!);
  assert.equal(v.stopId, "mill");
  assert.deepEqual(
    v.stage.figures.map((f) => f.model),
    ["settler"],
  );
});
