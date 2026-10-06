// World-locked figures: put a figure (a mammoth, a settler) on the ground and
// keep it in that one spot while the visitor walks around it, walks away and
// comes back.
//
// The device's WorldTracker (ports.ts) does the hard part, tracking its own
// pose and keeping anchors fixed to the real world. This module decides
// everything else, the same way on every device: where a tap actually puts
// the figure (never on top of the visitor), which way it faces, where it is
// this frame (anchor pose, corrected as the platform's map improves), whether
// to draw it, and what to tell the visitor. A display only draws StageView.

import type { TrackedFrame, TrackingQuality, WorldTracker } from "./ports.ts";
import {
  angleDiff,
  compose,
  dist,
  groundDist,
  invert,
  scale,
  sub,
  add,
  toDeg,
  toRad,
  yawOf,
  yawQuat,
  yawToward,
  type Pose,
} from "./space.ts";

/** A figure the visitor can place. Its 3D model is the display's business; the core needs only its size. */
export interface FigureSpec {
  id: string;
  /** "mammoth": used in prompts ("Tap to place the mammoth"). */
  name: string;
  /** Standing height in metres (true scale). */
  heightM: number;
  /** Radius of ground it covers, metres. The visitor is never placed inside it. */
  footprintM: number;
  /** Turn from facing the visitor, degrees counter-clockwise from above. 90 = shown side-on. */
  yawDeg: number;
}

export interface StageOptions {
  /** Clear ground kept between the visitor and the figure's footprint when placing. Default 1.5 m. */
  clearanceM?: number;
  /** Farthest placement; a farther aim is pulled in. Default 25 m. */
  maxPlaceM?: number;
  /** "phone" or "glasses": only changes the words of the prompts. */
  device?: "phone" | "glasses";
}

/**
 * anchoring: waiting for the platform to pin it. anchored: pinned to the world.
 * tracking-only: this device cannot anchor; held at its pose in tracking space.
 */
export type HoldState = "anchoring" | "anchored" | "tracking-only";

export interface FigureView {
  id: string;
  name: string;
  /** Where to draw it this frame, tracking space. Its -z is its front. */
  pose: Pose;
  visible: boolean;
  hold: HoldState;
  /** Ground distance from the viewer, metres. */
  distanceM: number | null;
  /** Turn to face it: + right, - left, degrees. */
  turnDeg: number | null;
  /** How far the visitor has walked around it, degrees, 0 to 360+. */
  aroundDeg: number;
  /** How far the platform has moved it since placement while correcting its map, metres. */
  correctionM: number;
}

export type StagePhase = "starting" | "scanning" | "ready" | "placed" | "lost";

export interface StageView {
  phase: StagePhase;
  quality: TrackingQuality;
  /** One sentence for the visitor. */
  prompt: string;
  /** Where a placement would land (already pushed clear of the visitor), or null. */
  reticle: Pose | null;
  canPlace: boolean;
  selected: string;
  figures: FigureView[];
}

interface Placed {
  spec: FigureSpec;
  placed: Pose;
  /** Which placement this is: a later place() of the same figure retires earlier anchor requests. */
  gen: number;
  anchorId: string | null;
  hold: HoldState;
  /** The figure in its anchor's frame, fixed when the anchor is first located. */
  offset: Pose | null;
  pose: Pose;
  correctionM: number;
  around: number;
  lastAngle: number | null;
}

/** Counting "walked around" stops beyond this distance, where a few steps sideways sweep large angles from GPS-free noise. */
const AROUND_MAX_M = 30;

export class FigureStage {
  private readonly specs: Map<string, FigureSpec>;
  private readonly placed = new Map<string, Placed>();
  private selectedId: string;
  private last: TrackedFrame | null = null;
  private gen = 0;
  private readonly clearance: number;
  private readonly maxPlace: number;
  private readonly aimWords: string;
  private readonly tracker: WorldTracker;

  constructor(tracker: WorldTracker, specs: readonly FigureSpec[], options: StageOptions = {}) {
    this.tracker = tracker;
    if (specs.length === 0) throw new Error("FigureStage needs at least one figure");
    this.specs = new Map(specs.map((s) => [s.id, s]));
    this.selectedId = specs[0]!.id;
    this.clearance = options.clearanceM ?? 1.5;
    this.maxPlace = options.maxPlaceM ?? 25;
    this.aimWords = options.device === "glasses" ? "Look at" : "Point the phone at";
  }

  get selected(): FigureSpec {
    return this.specs.get(this.selectedId)!;
  }

  select(id: string): void {
    if (!this.specs.has(id)) throw new Error(`unknown figure ${id}`);
    this.selectedId = id;
  }

  /**
   * Where a placement at `aim` really goes: on the aimed ground, pushed back so
   * the visitor stands clear of the footprint, pulled in past maxPlaceM, and
   * turned to face the visitor (plus the figure's own yaw).
   */
  placement(spec: FigureSpec, aim: Pose, viewer: Pose): Pose {
    const flat = { x: aim.position.x - viewer.position.x, y: 0, z: aim.position.z - viewer.position.z };
    const d = Math.hypot(flat.x, flat.z);
    const minD = spec.footprintM + this.clearance;
    let position = aim.position;
    if (d < minD || d > this.maxPlace) {
      // aimed at our own feet: push straight ahead along the view
      const yaw = yawOf(viewer.orientation);
      const dir = d > 1e-3 ? scale(flat, 1 / d) : { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
      const want = Math.min(Math.max(d, minD), this.maxPlace);
      position = add({ x: viewer.position.x, y: aim.position.y, z: viewer.position.z }, scale(dir, want));
    }
    const face = yawToward(position, viewer.position) + toRad(spec.yawDeg);
    return { position, orientation: yawQuat(face) };
  }

  /** Put the selected figure where the visitor is aiming. False if there is no ground to put it on yet. */
  async place(): Promise<boolean> {
    const f = this.last;
    if (!f?.aim || !f.viewer || f.quality === "lost") return false;
    const spec = this.selected;
    const pose = this.placement(spec, f.aim, f.viewer);
    this.remove(spec.id);
    const gen = ++this.gen;
    const p: Placed = {
      spec,
      placed: pose,
      gen,
      anchorId: null,
      hold: "anchoring",
      offset: null,
      pose,
      correctionM: 0,
      around: 0,
      lastAngle: null,
    };
    this.placed.set(spec.id, p);
    const id = await this.tracker.createAnchor(pose);
    const current = this.placed.get(spec.id);
    if (current?.gen !== gen) {
      // placed again (or removed) while this anchor was being made
      if (id != null) this.tracker.deleteAnchor(id);
      return true;
    }
    if (id == null) current.hold = "tracking-only";
    else current.anchorId = id;
    return true;
  }

  remove(id: string): void {
    const p = this.placed.get(id);
    if (!p) return;
    if (p.anchorId != null) this.tracker.deleteAnchor(p.anchorId);
    this.placed.delete(id);
  }

  clear(): void {
    for (const id of [...this.placed.keys()]) this.remove(id);
  }

  /** Answer one tracking frame. Call once per rendered frame, then draw the result. */
  frame(f: TrackedFrame): StageView {
    this.last = f;
    const viewer = f.quality === "lost" ? null : f.viewer;
    const figures: FigureView[] = [];

    for (const p of this.placed.values()) {
      let located = true;
      if (p.anchorId != null) {
        const a = f.anchors.get(p.anchorId);
        if (a) {
          // first sighting fixes the figure's place in the anchor's frame, so
          // a platform that turns or snaps its anchors cannot turn the figure
          p.offset ??= compose(invert(a), p.placed);
          p.pose = compose(a, p.offset);
          p.hold = "anchored";
          p.correctionM = dist(p.pose.position, p.placed.position);
        } else {
          located = false;
        }
      }

      let distanceM: number | null = null;
      let turnDeg: number | null = null;
      if (viewer) {
        distanceM = groundDist(viewer.position, p.pose.position);
        turnDeg = -toDeg(angleDiff(yawOf(viewer.orientation), yawToward(viewer.position, p.pose.position)));
        if (f.quality === "normal" && distanceM <= AROUND_MAX_M && distanceM > 0.3) {
          const rel = sub(viewer.position, p.pose.position);
          const angle = Math.atan2(rel.x, rel.z);
          if (p.lastAngle != null) p.around += angleDiff(p.lastAngle, angle);
          p.lastAngle = angle;
        } else {
          p.lastAngle = null;
        }
      }

      figures.push({
        id: p.spec.id,
        name: p.spec.name,
        pose: p.pose,
        // an anchor not located this frame keeps its last pose while tracking holds
        visible: viewer != null && (located || p.offset != null || p.anchorId == null),
        hold: p.hold,
        distanceM,
        turnDeg,
        aroundDeg: Math.abs(toDeg(p.around)),
        correctionM: p.correctionM,
      });
    }

    const reticle = viewer && f.aim ? this.placement(this.selected, f.aim, viewer) : null;
    const phase: StagePhase =
      f.viewer == null && this.placed.size === 0 && f.quality !== "lost"
        ? "starting"
        : f.quality === "lost"
          ? "lost"
          : this.placed.size > 0
            ? "placed"
            : reticle
              ? "ready"
              : "scanning";
    return {
      phase,
      quality: f.quality,
      prompt: this.prompt(phase, reticle != null, figures),
      reticle,
      canPlace: reticle != null,
      selected: this.selectedId,
      figures,
    };
  }

  private prompt(phase: StagePhase, canPlace: boolean, figures: FigureView[]): string {
    const name = this.selected.name;
    switch (phase) {
      case "starting":
        return "Starting the camera.";
      case "lost": {
        const placed = figures[0];
        return placed
          ? `Lost track. ${this.aimWords} the ground and move slowly. The ${placed.name} comes back where you left it.`
          : `Lost track. ${this.aimWords} the ground and move slowly.`;
      }
      case "scanning":
        return `${this.aimWords} the ground a few steps ahead and move slowly side to side.`;
      case "ready":
        return `Tap to place the ${name} there.`;
      case "placed": {
        const f = figures.find((x) => x.id === this.selectedId) ?? figures[0]!;
        if (f.hold === "anchoring") return `Pinning the ${f.name} to the ground.`;
        if (f.distanceM != null && f.turnDeg != null && Math.abs(f.turnDeg) > 40) {
          const side = Math.abs(f.turnDeg) > 135 ? "behind you" : f.turnDeg > 0 ? "to your right" : "to your left";
          return `The ${f.name} is ${side}, ${Math.round(f.distanceM)} m away.`;
        }
        if (f.aroundDeg >= 350) return `You've walked all the way around the ${f.name}. Walk away and come back.`;
        if (f.aroundDeg >= 30) return `${Math.round(f.aroundDeg)}° around the ${f.name}. Keep going.`;
        return canPlace
          ? `Walk around the ${f.name}. Tap again to move it.`
          : `Walk around the ${f.name}. It stays where you put it.`;
      }
    }
  }
}
