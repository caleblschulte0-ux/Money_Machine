// A fake world for world-tracking tests: a ground plane at y = 0, a visitor
// walking on it, and a TRACKING space that drifts away from the world the way
// a phone's does on a long walk. Anchors are fixed in the world, so their
// poses in tracking space move as the drift grows, which is what ARCore and
// ARKit report. Optional persistent anchors, for reload tests.
//
// World axes: +x east, -z north, +y up (metres). geo() maps a world point to
// latitude/longitude around ORIGIN; heading() is the compass reading of where
// the visitor faces.

import {
  compose,
  invert,
  toDeg,
  vec,
  yawOf,
  yawQuat,
  yawToward,
  IDENTITY,
  type Pose,
  type Vec3,
} from "../src/core/space.ts";
import { bearing, distance, norm, offset } from "../src/core/geo.ts";
import type { TrackedFrame, TrackingQuality, WorldTracker } from "../src/core/ports.ts";
import type { LatLon } from "../src/core/types.ts";
import type { FigureStage, StageView } from "../src/core/anchoring.ts";

export const ORIGIN: LatLon = { lat: 43.5446, lon: -96.7311 };

/** A world point (ground) as latitude/longitude. */
export function geo(p: Vec3): LatLon {
  const d = Math.hypot(p.x, p.z);
  return d < 1e-9 ? { ...ORIGIN } : offset(ORIGIN, d, norm(toDeg(Math.atan2(p.x, -p.z))));
}

/** Latitude/longitude as a world point on the ground. */
export function world(p: LatLon): Vec3 {
  const d = distance(ORIGIN, p);
  const b = (bearing(ORIGIN, p) * Math.PI) / 180;
  return vec(Math.sin(b) * d, 0, -Math.cos(b) * d);
}

const EYE = 1.5; // phone held at chest/eye height

/** A world the visitor walks in, seen through a drifting tracker. */
export class FakeWorld implements WorldTracker {
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

  /** Persistent anchors survive "reloads" (a new stage on the same world) when this is on. */
  canPersist = false;
  readonly persisted = new Map<string, Pose>();

  persistAnchor(id: string): Promise<string | null> {
    const w = this.worldAnchors.get(id);
    if (!this.canPersist || !w) return Promise.resolve(null);
    const handle = `h-${id}`;
    this.persisted.set(handle, w);
    return Promise.resolve(handle);
  }
  restoreAnchor(handle: string): Promise<string | null> {
    const w = this.persisted.get(handle);
    if (!this.canPersist || !w) return Promise.resolve(null);
    const id = `a${this.next++}`;
    this.worldAnchors.set(id, w);
    return Promise.resolve(id);
  }
  forgetAnchor(handle: string): void {
    this.persisted.delete(handle);
  }
  /** Lose an anchor (the platform gave up on it) without the stage being told. */
  dropAnchor(id: string): void {
    this.worldAnchors.delete(id);
  }

  /** Compass heading of where the visitor faces, degrees. */
  heading(): number {
    return norm(-toDeg(yawOf(this.viewer.orientation)));
  }

  /** The visitor's GPS fix. */
  fix(): LatLon {
    return geo(this.viewer.position);
  }

  /** One tracking frame, as the device would report it. */
  tracked(aimMetres: number | null = 6): TrackedFrame {
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
    return f;
  }

  frame(stage: FigureStage, aimMetres: number | null = 6): StageView {
    return stage.frame(this.tracked(aimMetres));
  }

  /** Where a figure the stage drew really is, in the world. */
  inWorld(pose: Pose): Vec3 {
    return compose(invert(this.drift), pose).position;
  }
}
