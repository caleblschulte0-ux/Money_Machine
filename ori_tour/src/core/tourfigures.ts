// Figures inside the tour: each stop's figure (tour.json `figure`) stands near
// the stop while the visitor is there, in one spot, and is gone between stops.
//
// How it gets there without a tap ("auto"): the device's tracking space has
// no idea where north is, so TourFigures learns it. Every steady frame pairs
// the viewer's yaw in tracking space with the compass heading; their sum is
// the turn between tracking space and the map (a circular mean of recent
// pairs). The GPS fix then says how far and in which direction the figure's
// spot is from the visitor, and the ground height comes from the platform's
// ground hits. GPS is good to a few metres and the compass to a few degrees,
// so an auto figure lands NEAR its spot, not on it; once down it is anchored
// and does not move. Where the fix is too rough, the compass unsteady or no
// ground has been seen, it falls back to the visitor tapping the ground.
//
// Losing it: an anchor the platform cannot find for a few seconds while
// tracking is good is dropped and the figure re-placed from the stop's
// position. Surviving a reload or screen lock needs persistent anchors
// (WorldTracker.persistAnchor), which only some platforms have; without them
// the figure is re-placed from the stop's position when the visitor is back.
//
// It works on FigureSites, not on tour stops directly: a tour's stops with a
// figure (tourSites) and a tester's saved test points (testpoints.ts) are both
// sites, so the parking lot runs exactly the code the park does. With
// freeSpawn, any catalogue figure can also be put where the visitor aims
// (spawn), with no site at all: "I'm looking at the falls, put the mammoth
// there".

import { FigureStage, isLevel, type FigureSpec, type StageView } from "./anchoring.ts";
import { FIGURES, figureById } from "./figures.ts";
import { bearing, distance, norm, offset } from "./geo.ts";
import type { Storage, TrackedFrame, WorldTracker } from "./ports.ts";
import { angleDiff, toDeg, toRad, yawOf, yawToward, type Vec3 } from "./space.ts";
import { targetBearing } from "./tour.ts";
import type { LatLon, StopFigure, Tour } from "./types.ts";

/** A place with a figure: a tour stop with a figure, or a saved test point. */
export interface FigureSite {
  id: string;
  name: string;
  position: LatLon;
  radius_m: number;
  figure: StopFigure;
  /** Direction from the site to its figure when figure.bearing_deg is null, degrees. */
  facingDeg: number;
}

/** The sites of a tour: its stops that have a figure. */
export function tourSites(tour: Tour): FigureSite[] {
  const out: FigureSite[] = [];
  for (const s of tour.stops)
    if (s.figure)
      out.push({
        id: s.id,
        name: s.name,
        position: s.position,
        radius_m: s.radius_m,
        figure: s.figure,
        facingDeg: targetBearing(s),
      });
  return out;
}

/** Where a site's figure stands on the ground. */
export function siteFigurePosition(site: FigureSite): LatLon {
  const f = site.figure;
  const b = f.bearing_deg ?? site.facingDeg;
  return f.offset_m > 0 ? offset(site.position, f.offset_m, norm(b)) : { ...site.position };
}

/** The nearest site whose radius contains `pos`, or null. */
export function siteAt(sites: readonly FigureSite[], pos: LatLon): FigureSite | null {
  let best: FigureSite | null = null;
  let bestD = Infinity;
  for (const s of sites) {
    const d = distance(pos, s.position);
    if (d <= s.radius_m && d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export interface TourFiguresOptions {
  /** Persisted anchor handles, where the platform can persist anchors. */
  storage?: Storage;
  /** Storage key prefix for anchor handles (one tour or test area, one device). Default "ori-figure-anchor". */
  storageKey?: string;
  /** Auto placement waits for a GPS fix at least this good, metres. Default 20. */
  maxAccuracyM?: number;
  /** Compass/tracking pairs averaged for north. Default 20. */
  alignSamples?: number;
  /** Pairs must agree within this, degrees (circular spread), before auto placement. Default 15. */
  alignSpreadDeg?: number;
  /** Ask for a tap if auto placement has not happened this long after arriving, ms. Default 12000. */
  tapAfterMs?: number;
  /** Re-place a figure whose anchor has been missing this long while tracking is good, ms. Default 4000. */
  lostReplaceMs?: number;
  /** The figure stays until the visitor is this far beyond the stop's radius, metres. Default 25. */
  keepBeyondM?: number;
  /** "phone" or "glasses": prompt wording. */
  device?: "phone" | "glasses";
  /** Let spawn() put any catalogue figure where the visitor aims (test mode). Default false. */
  freeSpawn?: boolean;
  /** Ground hits kept to judge the ground (median height, spread). Default 15. */
  groundSamples?: number;
  /** The ground counts as found once recent hits agree within this, metres. Default 0.15. */
  groundSpreadM?: number;
  /** Tracking must have been normal this long before a figure is placed, ms (see StageOptions). Default 1500. */
  settleMs?: number;
}

/** Everything a device needs to know about the stop's figure this frame. */
export interface TourFiguresInput {
  frame: TrackedFrame;
  /** Latest GPS fix, or null. */
  fix: { pos: LatLon; accuracy: number } | null;
  /** Compass heading in use (smoothed, calibrated), degrees, or null. */
  heading: number | null;
  headingSteady: boolean;
  /**
   * Where the visitor is: the tour engine's current stop (anything with an id;
   * a stop without a figure counts, it takes the last figure down), or for
   * test points siteAt(). Null between stops.
   */
  at: { id: string } | null;
}

export type FigureMode = "none" | "waiting" | "tap" | "standing";

export interface TourFiguresView {
  stage: StageView;
  mode: FigureMode;
  /** The site whose figure is active, or null. */
  stopId: string | null;
  /** The ground height in use (median of recent level hits), or null while the ground is not found. */
  groundY: number | null;
  /** One sentence for the visitor, or null when the figure has nothing to say (the tour guide speaks). */
  prompt: string | null;
  /** Why auto placement is waiting, for the readout. */
  waitingFor: string | null;
  /** Tracking-space turn to the map, once learned: yaw (radians) of a direction = northYaw - bearing. */
  northYaw: number | null;
}

const D = {
  maxAccuracyM: 20,
  alignSamples: 20,
  alignSpreadDeg: 15,
  tapAfterMs: 12000,
  lostReplaceMs: 4000,
  keepBeyondM: 25,
  groundSamples: 15,
  groundSpreadM: 0.15,
};

/** The stage id of a site's figure (a free-spawned figure's id is its model id). */
export const stopFigureId = (site: { id: string }): string => `stop:${site.id}`;

/** The FigureSpec for a site's figure: the catalogue figure at the site's scale and turn. */
export function stopFigureSpec(site: FigureSite): FigureSpec | null {
  const f = site.figure;
  const base = figureById(f.model);
  if (!base) return null;
  return {
    id: stopFigureId(site),
    name: base.name,
    model: base.id,
    scale: f.scale,
    heightM: base.heightM * f.scale,
    footprintM: base.footprintM * f.scale,
    yawDeg: f.yaw_deg,
  };
}

export class TourFigures {
  readonly stage: FigureStage;
  private readonly sites: Map<string, FigureSite>;
  private readonly tracker: WorldTracker;
  private readonly o: typeof D & {
    storage: Storage | undefined;
    storageKey: string;
    device: "phone" | "glasses";
    freeSpawn: boolean;
  };
  private readonly pairs: number[] = [];
  private readonly grounds: number[] = [];
  private active: FigureSite | null = null;
  private arrivedT: number | null = null;
  private placing = false;
  private persisted = new Set<string>();

  constructor(tracker: WorldTracker, sites: readonly FigureSite[], opts: TourFiguresOptions = {}) {
    this.tracker = tracker;
    this.sites = new Map(sites.map((s) => [s.id, s]));
    const pick = <K extends keyof typeof D>(k: K): number => opts[k] ?? D[k];
    this.o = {
      maxAccuracyM: pick("maxAccuracyM"),
      alignSamples: pick("alignSamples"),
      alignSpreadDeg: pick("alignSpreadDeg"),
      tapAfterMs: pick("tapAfterMs"),
      lostReplaceMs: pick("lostReplaceMs"),
      keepBeyondM: pick("keepBeyondM"),
      groundSamples: pick("groundSamples"),
      groundSpreadM: pick("groundSpreadM"),
      storage: opts.storage,
      storageKey: opts.storageKey ?? "ori-figure-anchor",
      device: opts.device ?? "phone",
      freeSpawn: opts.freeSpawn ?? false,
    };
    const specs = sites.map(stopFigureSpec).filter((s): s is FigureSpec => s != null);
    // the catalogue too, for spawn(); a stage needs at least one figure to select
    this.stage = new FigureStage(tracker, [...specs, ...FIGURES], {
      device: this.o.device,
      settleMs: opts.settleMs,
    });
  }

  /** Ground height: the median of recent level hits, once they agree. Null while the ground is not found. */
  groundY(): number | null {
    const n = this.grounds.length;
    if (n < Math.min(5, this.o.groundSamples)) return null;
    const sorted = [...this.grounds].sort((a, b) => a - b);
    const mid = sorted[Math.floor(n / 2)]!;
    // the middle two thirds must agree: one hit on a car bonnet does not move the ground
    const lo = sorted[Math.floor(n / 6)]!;
    const hi = sorted[Math.ceil((5 * n) / 6) - 1]!;
    return hi - lo <= this.o.groundSpreadM ? mid : null;
  }

  /** Replace the sites (a test point saved or deleted). Figures of sites that are gone are taken down. */
  setSites(sites: readonly FigureSite[]): void {
    for (const id of this.sites.keys())
      if (!sites.some((s) => s.id === id)) {
        this.stage.remove(stopFigureId({ id }));
        if (this.active?.id === id) {
          this.active = null;
          this.arrivedT = null;
        }
      }
    this.sites.clear();
    for (const s of sites) {
      this.sites.set(s.id, s);
      const spec = stopFigureSpec(s);
      if (spec) this.stage.addSpec(spec);
    }
  }

  /** Make a standing spawned figure the figure of a site, where it stands (no jump). */
  adoptSpawned(model: string, site: FigureSite): boolean {
    return this.stage.transfer(model, stopFigureId(site));
  }

  /** Put a catalogue figure where the visitor aims (freeSpawn). A second spawn of the same figure moves it. */
  async spawn(model: string): Promise<boolean> {
    if (!this.o.freeSpawn) return false;
    this.stage.select(model);
    return this.stage.place();
  }

  /** The learned turn from tracking space to the map, or null while the compass pairs disagree or are too few. */
  northYaw(): number | null {
    if (this.pairs.length < Math.min(this.o.alignSamples, 8)) return null;
    let sx = 0;
    let sy = 0;
    for (const a of this.pairs) {
      sx += Math.cos(a);
      sy += Math.sin(a);
    }
    const mean = Math.atan2(sy, sx);
    const spread = Math.max(...this.pairs.map((a) => Math.abs(angleDiff(mean, a))));
    return spread <= toRad(this.o.alignSpreadDeg) ? mean : null;
  }

  /** Where a map point is in tracking space, on the ground. Null until north, a fix and the ground are known. */
  toTracking(target: LatLon, viewerPos: Vec3, fix: LatLon): Vec3 | null {
    const north = this.northYaw();
    const ground = this.groundY();
    if (north == null || ground == null) return null;
    const d = distance(fix, target);
    const yaw = north - toRad(bearing(fix, target));
    return { x: viewerPos.x - Math.sin(yaw) * d, y: ground, z: viewerPos.z - Math.cos(yaw) * d };
  }

  /**
   * A standing figure as a site figure relative to where the visitor stands
   * (their fix): how far, which bearing, which way it is turned. Null until
   * north is learned. This is how "Set test point here" remembers a spawned
   * figure on the map.
   */
  capture(figureId: string, viewerPos: Vec3): Pick<StopFigure, "offset_m" | "bearing_deg" | "yaw_deg"> | null {
    const north = this.northYaw();
    const fig = this.stage.figuresNow().find((f) => f.id === figureId);
    if (north == null || !fig) return null;
    const p = fig.pose.position;
    const d = Math.hypot(p.x - viewerPos.x, p.z - viewerPos.z);
    const yaw = yawToward(viewerPos, p);
    const yawDeg = toDeg(angleDiff(yawToward(p, viewerPos), yawOf(fig.pose.orientation)));
    return {
      offset_m: Math.round(d * 10) / 10,
      bearing_deg: (Math.round(norm(toDeg(north - yaw)) * 10) / 10) % 360,
      yaw_deg: Math.round(yawDeg),
    };
  }

  /** The visitor tapped: place the active stop's figure on the aimed ground. */
  async tap(): Promise<boolean> {
    if (!this.active) return false;
    this.stage.select(stopFigureId(this.active));
    const ok = await this.stage.place();
    if (ok) await this.persist();
    return ok;
  }

  update(input: TourFiguresInput): TourFiguresView {
    const f = input.frame;
    // learn north and the ground from every good frame
    if (f.quality === "normal" && f.viewer && input.heading != null && input.headingSteady) {
      this.pairs.push(yawOf(f.viewer.orientation) + toRad(input.heading));
      if (this.pairs.length > this.o.alignSamples) this.pairs.shift();
    }
    if (f.aim && isLevel(f.aim)) {
      this.grounds.push(f.aim.position.y);
      if (this.grounds.length > this.o.groundSamples) this.grounds.shift();
    }

    this.follow(input);
    const stage = this.stage.frame(f);
    const stop = this.active;
    const groundY = this.groundY();
    if (!stop) {
      const prompt = this.o.freeSpawn ? stage.prompt : null;
      return { stage, mode: "none", stopId: null, prompt, waitingFor: null, northYaw: this.northYaw(), groundY };
    }

    const id = stopFigureId(stop);
    const fig = stage.figures.find((x) => x.id === id);
    const spec = stopFigureSpec(stop)!;
    // an anchor the platform has lost: drop it and put the figure back from the stop's position
    if (fig && fig.unlocatedMs > this.o.lostReplaceMs) {
      this.forget(stop);
      this.stage.remove(id);
    }
    if (fig && fig.hold === "anchored") void this.persist();

    let waitingFor: string | null = null;
    if (!fig && !this.placing) {
      waitingFor = this.autoBlocker(input, stop);
      if (waitingFor == null) this.autoPlace(input, stop);
    }

    const waitedLong = this.arrivedT != null && f.t - this.arrivedT > this.o.tapAfterMs;
    const tapMode = !fig && (stop.figure.anchoring === "tap" || waitedLong);
    if (tapMode) this.stage.select(id);
    const mode: FigureMode = fig ? "standing" : tapMode ? "tap" : "waiting";
    let prompt: string | null;
    if (stage.phase === "lost") prompt = stage.prompt;
    else if (mode === "standing") prompt = fig?.hold === "anchoring" ? stage.prompt : null;
    else if (mode === "tap")
      prompt = stage.canPlace
        ? `Tap the ground to place the ${spec.name}.`
        : `${this.o.device === "glasses" ? "Look at" : "Point the phone at"} the ground to place the ${spec.name}.`;
    else prompt = `Look around slowly: the ${spec.name} is about to appear.`;
    return { stage, mode, stopId: stop.id, prompt, waitingFor, northYaw: this.northYaw(), groundY };
  }

  /** Track which stop's figure should be up: arrive to raise it, walk well away to take it down. */
  private follow(input: TourFiguresInput): void {
    const at = input.at ? (this.sites.get(input.at.id) ?? null) : null;
    if (this.active && input.at && input.at.id !== this.active.id && !at) {
      // at another stop, one without a figure: this one's figure goes
      this.stage.remove(stopFigureId(this.active));
      this.active = null;
      this.arrivedT = null;
      return;
    }
    if (at && at.id !== this.active?.id) {
      if (this.active) this.stage.remove(stopFigureId(this.active));
      this.active = at;
      this.arrivedT = input.frame.t;
      this.restore(at);
      return;
    }
    if (this.active && !at && input.fix) {
      const away = distance(input.fix.pos, this.active.position);
      if (away > this.active.radius_m + this.o.keepBeyondM) {
        this.stage.remove(stopFigureId(this.active));
        this.active = null;
        this.arrivedT = null;
      }
    }
  }

  /** Why auto placement cannot happen yet, in words, or null when it can. */
  private autoBlocker(input: TourFiguresInput, stop: FigureSite): string | null {
    if (stop.figure.anchoring !== "auto") return "this figure is placed by a tap";
    if (input.frame.quality !== "normal" || !input.frame.viewer) return "tracking";
    if (!input.fix) return "GPS";
    if (input.fix.accuracy > this.o.maxAccuracyM) return `GPS (±${Math.round(input.fix.accuracy)} m)`;
    if (this.groundY() == null) return "the ground";
    if (this.northYaw() == null) return "a steady compass";
    return null;
  }

  private autoPlace(input: TourFiguresInput, stop: FigureSite): void {
    const viewer = input.frame.viewer;
    if (!viewer || !input.fix) return;
    const target = this.toTracking(siteFigurePosition(stop), viewer.position, input.fix.pos);
    if (!target) return;
    this.placing = true;
    void this.stage.placeAt(stopFigureId(stop), target).finally(() => (this.placing = false));
  }

  // ---- persistence (only where the platform has persistent anchors) ----

  private key(stop: FigureSite): string {
    return `${this.o.storageKey}:${stop.id}`;
  }

  private restore(stop: FigureSite): void {
    const handle = this.o.storage?.get(this.key(stop));
    if (!handle || !this.tracker.restoreAnchor) return;
    this.placing = true;
    void this.tracker
      .restoreAnchor(handle)
      .then((anchorId) => {
        if (anchorId != null && this.active?.id === stop.id) {
          this.stage.adopt(stopFigureId(stop), anchorId);
          this.persisted.add(stop.id);
        } else if (anchorId == null) this.forget(stop);
      })
      .finally(() => (this.placing = false));
  }

  private async persist(): Promise<void> {
    const stop = this.active;
    if (!stop || this.persisted.has(stop.id) || !this.tracker.persistAnchor || !this.o.storage) return;
    const fig = this.stage.standing(stopFigureId(stop));
    if (fig?.hold !== "anchored" || fig.anchorId == null) return;
    this.persisted.add(stop.id);
    const handle = await this.tracker.persistAnchor(fig.anchorId);
    if (handle) this.o.storage.set(this.key(stop), handle);
    else this.persisted.delete(stop.id);
  }

  private forget(stop: FigureSite): void {
    const handle = this.o.storage?.get(this.key(stop));
    if (handle) {
      this.tracker.forgetAnchor?.(handle);
      this.o.storage?.remove(this.key(stop));
    }
    this.persisted.delete(stop.id);
  }
}
