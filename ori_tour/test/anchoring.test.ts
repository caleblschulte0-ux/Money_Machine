// World-locked figures, headless. A fake WorldTracker simulates the real
// world: a ground plane, a visitor walking on it, and a TRACKING space that
// drifts away from the world the way a phone's does on a long walk. Anchors
// are fixed in the world, so their poses in tracking space move as the drift
// grows; that is exactly what ARCore and ARKit report.
//
// The tests then check what Caleb asked for: a figure put down in one spot
// stays in that spot (in the WORLD, not just on screen) while the visitor
// walks all the way around it, walks away, loses tracking and comes back.

import assert from "node:assert/strict";
import { test } from "node:test";

import { FigureStage, type FigureSpec, type StageView } from "../src/core/anchoring.ts";
import { FIGURES } from "../src/core/figures.ts";
import type { TrackedFrame, TrackingQuality, WorldTracker } from "../src/core/ports.ts";
import {
  compose,
  dist,
  groundDist,
  IDENTITY,
  invert,
  vec,
  yawOf,
  yawQuat,
  yawToward,
  type Pose,
  type Vec3,
} from "../src/core/space.ts";

const MAMMOTH = FIGURES.find((f) => f.id === "mammoth")!;
const SETTLER = FIGURES.find((f) => f.id === "settler")!;
const EYE = 1.5; // phone held at chest/eye height

/** A world the visitor walks in, seen through a drifting tracker. */
class FakeWorld implements WorldTracker {
  /** tracking space from world: grows on a long walk, the way phone tracking drifts */
  drift: Pose = { position: vec(0, 0, 0), orientation: IDENTITY };
  viewer: Pose = { position: vec(0, EYE, 0), orientation: IDENTITY };
  quality: TrackingQuality = "normal";
  canAnchor = true;
  readonly worldAnchors = new Map<string, Pose>();
  deleted: string[] = [];
  private next = 1;
  private onFrame: ((f: TrackedFrame) => void) | null = null;
  t = 0;

  start(onFrame: (f: TrackedFrame) => void): Promise<string | null> {
    this.onFrame = onFrame;
    return Promise.resolve(null);
  }
  stop(): void {
    this.onFrame = null;
  }
  createAnchor(pose: Pose): Promise<string | null> {
    if (!this.canAnchor) return Promise.resolve(null);
    const id = `a${this.next++}`;
    this.worldAnchors.set(id, compose(invert(this.drift), pose));
    return Promise.resolve(id);
  }
  deleteAnchor(id: string): void {
    this.deleted.push(id);
    this.worldAnchors.delete(id);
  }

  /** Stand at a world point, facing a world point (both on the ground). */
  standAt(at: Vec3, facing: Vec3): void {
    this.viewer = { position: vec(at.x, EYE, at.z), orientation: yawQuat(yawToward(at, facing)) };
  }

  /** The visitor's view of the ground 'metres' ahead, in tracking space. */
  aim(metres: number): Pose {
    const yaw = yawOf(this.viewer.orientation);
    const world = {
      position: vec(
        this.viewer.position.x - Math.sin(yaw) * metres,
        0,
        this.viewer.position.z - Math.cos(yaw) * metres,
      ),
      orientation: IDENTITY,
    };
    return compose(this.drift, world);
  }

  frame(stage: FigureStage, aimMetres: number | null = 6): StageView {
    this.t += 33;
    const lost = this.quality === "lost";
    const anchors = new Map<string, Pose | null>();
    for (const [id, w] of this.worldAnchors) anchors.set(id, lost ? null : compose(this.drift, w));
    const f: TrackedFrame = {
      t: this.t,
      viewer: lost ? null : compose(this.drift, this.viewer),
      quality: this.quality,
      aim: lost || aimMetres == null ? null : this.aim(aimMetres),
      anchors,
    };
    this.onFrame?.(f);
    return stage.frame(f);
  }

  /** Where a figure the stage drew really is, in the world. */
  inWorld(pose: Pose): Vec3 {
    return compose(invert(this.drift), pose).position;
  }
}

const settle = (): Promise<void> => new Promise((r) => setImmediate(r));

async function placeMammoth(world: FakeWorld, stage: FigureStage, aim = 6): Promise<Vec3> {
  world.standAt(vec(0, 0, 0), vec(0, 0, -10)); // facing -z
  world.frame(stage, aim);
  assert.equal(await stage.place(), true);
  await settle();
  const v = world.frame(stage, aim);
  const fig = v.figures[0]!;
  assert.equal(fig.hold, "anchored");
  return world.inWorld(fig.pose);
}

test("placing: the figure lands on the aimed ground, faces the visitor side-on, and never on top of them", () => {
  const world = new FakeWorld();
  const stage = new FigureStage(world, [MAMMOTH, SETTLER]);
  world.standAt(vec(0, 0, 0), vec(0, 0, -10));

  let v = world.frame(stage, 8);
  assert.equal(v.phase, "ready");
  assert.match(v.prompt, /Tap to place the mammoth/);
  assert.ok(Math.abs(v.reticle!.position.z + 8) < 1e-9, "on the aimed ground, 8 m ahead");

  // aiming at our own feet: pushed out to footprint + clearance
  v = world.frame(stage, 0.5);
  const d = groundDist(vec(0, 0, 0), v.reticle!.position);
  assert.ok(Math.abs(d - (MAMMOTH.footprintM + 1.5)) < 1e-9, `pushed clear of the visitor (${d} m)`);
  assert.equal(v.reticle!.position.y, 0, "still on the ground");

  // far away: pulled in
  v = world.frame(stage, 80);
  assert.ok(Math.abs(groundDist(vec(0, 0, 0), v.reticle!.position) - 25) < 1e-9);

  // the mammoth stands side-on to the visitor (front turned 90 degrees from facing them)
  v = world.frame(stage, 8);
  const facing = yawToward(v.reticle!.position, vec(0, 0, 0));
  const yaw = yawOf(v.reticle!.orientation);
  assert.ok(Math.abs(Math.abs(yaw - facing) - Math.PI / 2) < 1e-9);

  // the settler faces the visitor
  stage.select("settler");
  v = world.frame(stage, 8);
  assert.ok(Math.abs(yawOf(v.reticle!.orientation) - yawToward(v.reticle!.position, vec(0, 0, 0))) < 1e-9);
  assert.match(v.prompt, /settler/);
});

test("walking all the way around: the mammoth stays in its spot in the world while tracking drifts", async () => {
  const world = new FakeWorld();
  const stage = new FigureStage(world, [MAMMOTH]);
  const home = await placeMammoth(world, stage, 6);

  // walk a full circle of radius 8 m around it, plus a bit, while the
  // tracking space drifts 0.8 m and 4 degrees (a bad phone on a long walk)
  const steps = 400;
  let worst = 0;
  let v: StageView | null = null;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2.1 * Math.PI;
    const k = i / steps;
    world.drift = { position: vec(0.6 * k, 0.05 * k, -0.5 * k), orientation: yawQuat((4 * k * Math.PI) / 180) };
    world.standAt(vec(home.x + 8 * Math.sin(a), 0, home.z + 8 * Math.cos(a)), home);
    v = world.frame(stage, null);
    const fig = v.figures[0]!;
    assert.equal(fig.visible, true);
    worst = Math.max(worst, dist(world.inWorld(fig.pose), home));
    assert.ok(Math.abs(fig.turnDeg!) < 1e-6, "always straight ahead while circling and facing it");
  }
  assert.ok(worst < 0.01, `stayed within 1 cm of where it was put (worst ${worst.toFixed(4)} m)`);
  const fig = v!.figures[0]!;
  assert.ok(fig.aroundDeg >= 360, `walked ${fig.aroundDeg} degrees around`);
  assert.ok(fig.correctionM > 0.5, "the platform's corrections were applied, not ignored");
  assert.match(v!.prompt, /all the way around the mammoth/);
});

test("walking away, losing tracking and coming back: it is still where it was", async () => {
  const world = new FakeWorld();
  const stage = new FigureStage(world, [MAMMOTH]);
  const home = await placeMammoth(world, stage, 6);

  // walk 60 m away, facing away from it
  world.standAt(vec(0, 0, 60), vec(0, 0, 100));
  world.drift = { position: vec(1.2, 0, 0.4), orientation: yawQuat(0.05) };
  let v = world.frame(stage, null);
  assert.equal(v.phase, "placed");
  assert.match(v.prompt, /mammoth is behind you, 6\d m away/);

  // tracking lost (phone covered, fast turn)
  world.quality = "lost";
  v = world.frame(stage, null);
  assert.equal(v.phase, "lost");
  assert.equal(v.figures[0]!.visible, false, "nothing drawn while the device does not know where it is");
  assert.match(v.prompt, /comes back where you left it/);
  assert.equal(await stage.place(), false, "cannot place while lost");

  // tracking back, walk back, look at it
  world.quality = "normal";
  world.drift = { position: vec(1.5, 0.1, 0.9), orientation: yawQuat(0.08) };
  world.standAt(vec(0, 0, 5), home);
  v = world.frame(stage, null);
  const fig = v.figures[0]!;
  assert.equal(fig.visible, true);
  assert.ok(dist(world.inWorld(fig.pose), home) < 0.01, "same spot in the world");
  assert.ok(Math.abs(fig.distanceM! - groundDist(vec(0, 0, 5), home)) < 0.01);
});

test("a device that cannot anchor still shows the figure, holds it by tracking alone, and says so", async () => {
  const world = new FakeWorld();
  world.canAnchor = false;
  const stage = new FigureStage(world, [MAMMOTH]);
  world.standAt(vec(0, 0, 0), vec(0, 0, -10));
  world.frame(stage, 6);
  await stage.place();
  await settle();
  let v = world.frame(stage, null);
  assert.equal(v.figures[0]!.hold, "tracking-only");
  const placedAt = world.inWorld(v.figures[0]!.pose);

  // without an anchor the figure is only as fixed as the tracking space is
  world.drift = { position: vec(0.5, 0, 0), orientation: IDENTITY };
  v = world.frame(stage, null);
  assert.ok(Math.abs(dist(world.inWorld(v.figures[0]!.pose), placedAt) - 0.5) < 1e-9);
});

test("placing again moves the figure and releases the old anchor; a second figure can stand beside it", async () => {
  const world = new FakeWorld();
  const stage = new FigureStage(world, [MAMMOTH, SETTLER]);
  await placeMammoth(world, stage, 6);
  const first = [...world.worldAnchors.keys()][0]!;

  world.frame(stage, 12);
  await stage.place();
  await settle();
  assert.deepEqual(world.deleted, [first]);
  let v = world.frame(stage, null);
  assert.equal(v.figures.length, 1);
  assert.ok(Math.abs(groundDist(vec(0, 0, 0), world.inWorld(v.figures[0]!.pose)) - 12) < 0.01);

  stage.select("settler");
  world.frame(stage, 4);
  await stage.place();
  await settle();
  v = world.frame(stage, null);
  assert.deepEqual(v.figures.map((f) => f.id).sort(), ["mammoth", "settler"]);
});

test("an anchor that arrives after the figure was placed again is released, not leaked", async () => {
  const world = new FakeWorld();
  const stage = new FigureStage(world, [MAMMOTH]);
  world.standAt(vec(0, 0, 0), vec(0, 0, -10));
  world.frame(stage, 6);
  const a = stage.place();
  const b = stage.place(); // tapped twice before the first anchor resolved
  await Promise.all([a, b]);
  assert.equal(world.worldAnchors.size, 1, "only the latest placement keeps an anchor");
  assert.equal(world.deleted.length, 1);
});

test("before any ground is found there is nothing to place on", async () => {
  const world = new FakeWorld();
  const stage = new FigureStage(world, [MAMMOTH], { device: "glasses" });
  world.standAt(vec(0, 0, 0), vec(0, 0, -10));
  const v = world.frame(stage, null);
  assert.equal(v.phase, "scanning");
  assert.equal(v.canPlace, false);
  assert.match(v.prompt, /^Look at the ground/);
  assert.equal(await stage.place(), false);
});

test("figure sizes are true scale and every figure says where its model comes from", () => {
  const ids = new Set<string>();
  for (const f of FIGURES as readonly (FigureSpec & { credit: string })[]) {
    assert.ok(!ids.has(f.id), `duplicate id ${f.id}`);
    ids.add(f.id);
    assert.ok(f.credit.length > 20, `${f.id} needs a credit`);
    assert.ok(f.heightM > 0 && f.footprintM > 0);
  }
  assert.ok(MAMMOTH.heightM >= 2.7 && MAMMOTH.heightM <= 3.6, "woolly mammoth: 2.7 to 3.4 m at the shoulder");
});
