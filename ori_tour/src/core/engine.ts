// The tour engine: one loop, the same on every device and in every test.
//
//   arrive at a stop (GPS geofence) -> face the landmark (compass) ->
//   stand still -> the scene appears and the narration plays -> walk on.
//
// It knows nothing about screens, speakers or sensor APIs. It is fed raw
// timestamped readings, ticked with a clock, and emits events:
//
//   narrate    play this stop's narration; call narrationEnded() when done
//   stop-done  a stop finished (or was skipped, or cut short by walking on)
//   tour-done  every stop is done
//
// TourSession (session.ts) wires it to the device ports; replay.ts drives it
// with a recorded walk on a virtual clock.

import { distance, norm, turn } from "./geo.ts";
import { HeadingFilter, type HeadingOptions } from "./heading.ts";
import { StillnessDetector, type StillnessOptions } from "./stillness.ts";
import { targetBearing } from "./tour.ts";
import type { LatLon, Stop, Tour } from "./types.ts";

/** Extra degrees allowed once facing, so the picture does not flicker at the edge. */
export const FACING_HYSTERESIS_DEG = 10;
/** A staff override holds until the visitor walks this far from the stop. */
export const FORCED_RELEASE_M = 60;

export type EngineEvent =
  | { type: "narrate"; stop: Stop; t: number }
  | { type: "stop-done"; stop: Stop; next: Stop | null; t: number }
  | { type: "tour-done"; t: number };

export interface EngineOptions {
  /** false for devices with no usable compass: arrival + stillness shows the scene. */
  requireFacing?: boolean;
  onEvent?: (e: EngineEvent) => void;
  heading?: Partial<HeadingOptions>;
  stillness?: Partial<StillnessOptions>;
}

export interface EngineState {
  pos: LatLon | null;
  accuracy: number | null;
  speed: number;
  error: string | null;
  /** smoothed compass heading before calibration */
  raw: number | null;
  /** heading in use (smoothed + calibration offset) */
  heading: number | null;
  calib: number;
  headingSteady: boolean;
  still: boolean;
  moving: boolean;
  stillSource: "motion" | "gps";
  visited: Set<string>;
  /** index into map legs of the leg being walked */
  legIndex: number;
  nextId: string | null;
  atStop: Stop | null;
  facing: boolean;
  showing: Stop | null;
  narrating: string | null;
  forced: Stop | null;
  done: boolean;
}

export class TourEngine {
  readonly tour: Tour;
  readonly requireFacing: boolean;
  readonly state: EngineState;
  private readonly onEvent: (e: EngineEvent) => void;
  private readonly headingFilter: HeadingFilter;
  private readonly stillness: StillnessDetector;

  constructor(tour: Tour, opts: EngineOptions = {}) {
    this.tour = tour;
    this.requireFacing = opts.requireFacing !== false;
    this.onEvent = opts.onEvent ?? (() => {});
    this.headingFilter = new HeadingFilter(opts.heading);
    this.stillness = new StillnessDetector({
      stillBelowMps: tour.safety.still_below_mps,
      stillForS: tour.safety.still_for_seconds,
      ...opts.stillness,
    });
    this.state = {
      pos: null,
      accuracy: null,
      speed: 0,
      error: null,
      raw: null,
      heading: null,
      calib: 0,
      headingSteady: true,
      still: false,
      moving: false,
      stillSource: "gps",
      visited: new Set(),
      legIndex: 0,
      nextId: tour.stops[0]?.id ?? null,
      atStop: null,
      facing: false,
      showing: null,
      narrating: null,
      forced: null,
      done: false,
    };
  }

  // ------------------------------------------------------------ inputs

  location(r: { t: number; pos?: LatLon; accuracy?: number; speed?: number | null; error?: string }): EngineState {
    const s = this.state;
    if (r.error || !r.pos) {
      s.error = r.error ?? "No position.";
      return this.tick(r.t);
    }
    s.error = null;
    s.pos = r.pos;
    s.accuracy = r.accuracy ?? null;
    s.speed = this.stillness.gps({ t: r.t, pos: r.pos, acc: r.accuracy ?? 0, speed: r.speed ?? null });
    return this.tick(r.t);
  }

  /** Raw compass heading, degrees from true north. */
  heading(raw: number, t: number): EngineState {
    const s = this.state;
    s.raw = this.headingFilter.push(raw, t);
    s.heading = norm(s.raw + s.calib);
    s.headingSteady = this.headingFilter.steady();
    return this.tick(t);
  }

  /** |acceleration including gravity|, m/s^2 */
  motion(magnitude: number, t: number): void {
    this.stillness.motion(t, magnitude);
  }

  // ------------------------------------------------------------ commands

  /** "I'm facing it": the visitor is looking at the landmark, so the compass is off by this much. */
  calibrate(t: number): boolean {
    const s = this.state;
    if (!s.atStop || s.raw == null) return false;
    s.calib = turn(s.raw, targetBearing(s.atStop));
    s.heading = norm(s.raw + s.calib);
    this.tick(t);
    return true;
  }

  /** Staff override: show the scene here (or for the next stop) regardless of GPS or compass. */
  force(t: number): void {
    const s = this.state;
    const stop = s.atStop ?? this.tour.stops.find((x) => x.id === s.nextId);
    if (!stop) return;
    s.forced = stop;
    this.tick(t);
  }

  skip(t: number): void {
    const stop = this.tour.stops.find((x) => x.id === this.state.nextId);
    if (stop) this.finishStop(stop, t);
  }

  narrationEnded(stopId: string, t: number): void {
    const stop = this.tour.stops.find((x) => x.id === stopId);
    if (stop && this.state.narrating === stopId) this.finishStop(stop, t);
  }

  // ------------------------------------------------------------ the loop

  tick(t: number): EngineState {
    const s = this.state;
    s.still = this.stillness.still(t);
    s.speed = this.stillness.speed;
    s.moving = this.stillness.moving();
    s.stillSource = this.stillness.source(t);

    // Which stop are we inside? Prefer the next unvisited one.
    let at: Stop | null = null;
    if (s.pos) {
      for (const stop of this.tour.stops) {
        if (distance(s.pos, stop.position) <= stop.radius_m && (!at || stop.id === s.nextId)) at = stop;
      }
    }
    if (s.forced && (!at || at.id !== s.forced.id)) {
      if (!s.pos || distance(s.pos, s.forced.position) < FORCED_RELEASE_M) at = s.forced;
      else s.forced = null;
    }
    s.atStop = at;

    if (at && s.heading != null) {
      const off = Math.abs(turn(s.heading, targetBearing(at)));
      const tol = at.facing.tolerance_deg;
      s.facing = s.facing ? off <= tol + FACING_HYSTERESIS_DEG : off <= tol;
    } else s.facing = false;

    const forced = !!(at && s.forced && s.forced.id === at.id);
    const facingOk = s.facing || !this.requireFacing;
    const stillOk = s.still || !this.tour.safety.pictures_only_when_still;
    s.showing = at && (forced || (facingOk && stillOk)) ? at : null;

    if (s.showing && s.narrating !== s.showing.id && !s.visited.has(s.showing.id)) {
      // Walked on to another stop before the last one finished: that one is
      // done (cut short), or the tour could never complete.
      const cutId = s.narrating;
      const cut = cutId ? this.tour.stops.find((x) => x.id === cutId) : undefined;
      if (cut) {
        s.narrating = null;
        this.finishStop(cut, t);
        // finishStop re-ticked and has already handled the new stop
        if (s.narrating || !s.showing || s.visited.has(s.showing.id)) return s;
      }
      s.narrating = s.showing.id;
      this.onEvent({ type: "narrate", stop: s.showing, t });
    }
    return s;
  }

  private finishStop(stop: Stop, t: number): void {
    const s = this.state;
    if (s.narrating === stop.id) s.narrating = null;
    s.visited.add(stop.id);
    s.forced = null;
    const i = this.tour.stops.findIndex((x) => x.id === stop.id);
    s.legIndex = Math.max(s.legIndex, i + 1);
    const next = this.tour.stops.find((x) => !s.visited.has(x.id)) ?? null;
    s.nextId = next ? next.id : null;
    this.onEvent({ type: "stop-done", stop, next, t });
    if (!next && !s.done) {
      s.done = true;
      this.onEvent({ type: "tour-done", t });
    }
    this.tick(t);
  }
}
