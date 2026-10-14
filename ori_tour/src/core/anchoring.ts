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
  IDENTITY,
  angleDiff,
  compose,
  dist,
  groundDist,
  invert,
  rotate,
  scale,
  sub,
  add,
  toDeg,
  toRad,
  yawOf,
  yawQuat,
  yawToward,
  type Pose,
  type Vec3,
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
  /** Which 3D model draws it, when that differs from id (a tour's per-stop figure). Default: id. */
  model?: string;
  /** Model scale, 1 = true size. heightM and footprintM are already scaled. Default 1. */
  scale?: number;
}

export interface StageOptions {
  /** Clear ground kept between the visitor and the figure's footprint when placing. Default 1.5 m. */
  clearanceM?: number;
  /** Farthest placement; a farther aim is pulled in. Default 25 m. */
  maxPlaceM?: number;
  /** "phone" or "glasses": only changes the words of the prompts. */
  device?: "phone" | "glasses";
  /** Steepest surface a figure may stand on, degrees from level. A wall or a car door is not ground. Default 20. */
  maxSlopeDeg?: number;
  /**
   * How long tracking must have been "normal" without a break before anything
   * is placed, ms. An anchor made in the first moments of a session, before the
   * phone has mapped the ground, is the one that drifts most as the map
   * corrects. Default 1500.
   */
  settleMs?: number;
}

/**
 * Whether a hit is on ground a figure can stand on: the hit pose's +y is the
 * surface normal (WebXR hit-test results, and the convention for any port).
 */
export function isLevel(hit: Pose, maxSlopeDeg = 20): boolean {
  return rotate(hit.orientation, { x: 0, y: 1, z: 0 }).y >= Math.cos(toRad(maxSlopeDeg));
}

/**
 * anchoring: waiting for the platform to pin it. anchored: pinned to the world.
 * tracking-only: this device cannot anchor; held at its pose in tracking space.
 */
export type HoldState = "anchoring" | "anchored" | "tracking-only";

export interface FigureView {
  id: string;
  name: string;
  /** Which 3D model to draw, at what scale. */
  model: string;
  scale: number;
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
  /** The platform anchor holding it, if any (for persistence). */
  anchorId: string | null;
  /** How long its anchor has gone unlocated while tracking was normal, ms (0 when located). */
  unlocatedMs: number;
}

export type StagePhase = "starting" | "scanning" | "ready" | "placed" | "lost";

export interface StageView {
  phase: StagePhase;
  quality: TrackingQuality;
  /** Tracking has been normal long enough to place something (see StageOptions.settleMs). */
  settled: boolean;
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
  /** When the anchor was last located, or when it was pinned. */
  seenT: number | null;
}

/** Counting "walked around" stops beyond this distance, where a few steps sideways sweep large angles from GPS-free noise. */
const AROUND_MAX_M = 30;

export class FigureStage {
  private readonly specs: Map<string, FigureSpec>;
  private readonly placed = new Map<string, Placed>();
  private selectedId: string;
  private last: TrackedFrame | null = null;
  private lastFigures: FigureView[] = [];
  private gen = 0;
  private readonly clearance: number;
  private readonly maxPlace: number;
  private readonly aimWords: string;
  private readonly maxSlope: number;
  private readonly settleMs: number;
  private normalSince: number | null = null;
  private readonly tracker: WorldTracker;

  constructor(tracker: WorldTracker, specs: readonly FigureSpec[], options: StageOptions = {}) {
    this.tracker = tracker;
    if (specs.length === 0) throw new Error("FigureStage needs at least one figure");
    this.specs = new Map(specs.map((s) => [s.id, s]));
    this.selectedId = specs[0]!.id;
    this.clearance = options.clearanceM ?? 1.5;
    this.maxPlace = options.maxPlaceM ?? 25;
    this.aimWords = options.device === "glasses" ? "Look at" : "Point the phone at";
    this.maxSlope = options.maxSlopeDeg ?? 20;
    this.settleMs = options.settleMs ?? 1500;
  }

  /** Whether tracking has been normal long enough to place something that should stay put. */
  get settled(): boolean {
    const f = this.last;
    return f != null && this.normalSince != null && f.t - this.normalSince >= this.settleMs;
  }

  /** The frame's aim, if it is on level ground. */
  private groundAim(f: TrackedFrame): Pose | null {
    return f.aim && isLevel(f.aim, this.maxSlope) ? f.aim : null;
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

  /** Add a figure the stage did not start with (a tour adds each stop's figure). */
  addSpec(spec: FigureSpec): void {
    this.specs.set(spec.id, spec);
  }

  /** A standing figure's anchor and hold, or null if it is not standing. */
  standing(id: string): { anchorId: string | null; hold: HoldState } | null {
    const p = this.placed.get(id);
    return p ? { anchorId: p.anchorId, hold: p.hold } : null;
  }

  /** The figures as the last frame() saw them. */
  figuresNow(): readonly FigureView[] {
    return this.lastFigures;
  }

  /** Ids of the figures standing now. */
  get placedIds(): string[] {
    return [...this.placed.keys()];
  }

  /** Put the selected figure where the visitor is aiming. False if there is no ground to put it on yet. */
  async place(): Promise<boolean> {
    const f = this.last;
    const aim = f ? this.groundAim(f) : null;
    if (!f || !aim || !f.viewer || !this.settled) return false;
    const spec = this.selected;
    return this.pin(spec, this.placement(spec, aim, f.viewer));
  }

  /**
   * Put a figure at a point worked out some other way (a tour stop's position
   * through the compass and GPS), on the ground, with the same clearance and
   * facing rules as a tap. False while the device does not know where it is.
   */
  async placeAt(id: string, target: Vec3): Promise<boolean> {
    const f = this.last;
    const spec = this.specs.get(id);
    if (!spec) throw new Error(`unknown figure ${id}`);
    if (!f?.viewer || !this.settled) return false;
    return this.pin(spec, this.placement(spec, { position: target, orientation: IDENTITY }, f.viewer));
  }

  /**
   * Stand a figure on an anchor the platform restored from an earlier session
   * (persistent anchors). The anchor was made at the figure's own pose.
   */
  adopt(id: string, anchorId: string): void {
    const spec = this.specs.get(id);
    if (!spec) throw new Error(`unknown figure ${id}`);
    this.remove(id);
    const pose: Pose = { position: { x: 0, y: 0, z: 0 }, orientation: IDENTITY };
    this.placed.set(id, {
      ...this.fresh(spec, pose),
      anchorId,
      // the anchor IS the figure's pose: no offset to learn
      offset: { position: { x: 0, y: 0, z: 0 }, orientation: IDENTITY },
    });
  }

  private fresh(spec: FigureSpec, pose: Pose): Placed {
    return {
      spec,
      placed: pose,
      gen: ++this.gen,
      anchorId: null,
      hold: "anchoring",
      offset: null,
      pose,
      correctionM: 0,
      around: 0,
      lastAngle: null,
      seenT: this.last?.t ?? null,
    };
  }

  private async pin(spec: FigureSpec, pose: Pose): Promise<boolean> {
    this.remove(spec.id);
    const p = this.fresh(spec, pose);
    const gen = p.gen;
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

  /**
   * Hand a standing figure, anchor and all, to another figure id (a spawned
   * figure becomes a test point's figure without moving). False if `from` is
   * not standing.
   */
  transfer(from: string, to: string): boolean {
    const p = this.placed.get(from);
    const spec = this.specs.get(to);
    if (!p || !spec) return false;
    this.placed.delete(from);
    this.remove(to);
    this.placed.set(to, { ...p, spec });
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
    if (f.quality !== "normal") this.normalSince = null;
    else this.normalSince ??= f.t;
    const viewer = f.quality === "lost" ? null : f.viewer;
    const figures: FigureView[] = [];

    for (const p of this.placed.values()) {
      let located = true;
      if (p.anchorId != null) {
        const a = f.anchors.get(p.anchorId);
        if (a) {
          p.seenT = f.t;
          if (p.offset == null) {
            // first sighting fixes the figure's place in the anchor's frame, so
            // a platform that turns or snaps its anchors cannot turn the figure
            p.offset = compose(invert(a), p.placed);
          } else if (p.hold === "anchoring") {
            // adopted from an earlier session: it stands where the anchor came back
            p.placed = compose(a, p.offset);
          }
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

      const unlocatedMs =
        p.anchorId != null && !located && f.quality === "normal" && p.seenT != null ? f.t - p.seenT : 0;
      figures.push({
        id: p.spec.id,
        name: p.spec.name,
        model: p.spec.model ?? p.spec.id,
        scale: p.spec.scale ?? 1,
        anchorId: p.anchorId,
        unlocatedMs,
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

    this.lastFigures = figures;
    const aim = this.groundAim(f);
    const reticle = viewer && aim && this.settled ? this.placement(this.selected, aim, viewer) : null;
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
      settled: this.settled,
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
