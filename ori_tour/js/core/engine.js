// The tour engine: one loop, the same on every device and in every test.
//
//   arrive at a stop (GPS geofence) -> face the landmark (compass) ->
//   stand still -> the scene appears and the narration plays -> walk on.
//
// It knows nothing about screens, speakers or sensors APIs. A shell feeds it
// raw readings (location, heading, accelerometer) with timestamps, calls
// tick(now) on a timer, and reacts to the events it emits:
//
//   {type: "narrate", stop}        start this stop's narration; call
//                                  narrationEnded(stop.id) when it finishes
//   {type: "stop-done", stop, next}
//   {type: "tour-done"}
//
// and reads `engine.state` to draw. A replay drives it with a recorded walk
// and a fake clock, which is how it is tested without being at the park.

import { distance, turn, norm } from "./geo.js";
import { HeadingFilter } from "./heading.js";
import { StillnessDetector } from "./stillness.js";
import { targetBearing } from "./tour.js";

export const FACING_HYSTERESIS_DEG = 10; // so the picture does not flicker at the edge
export const FORCED_RELEASE_M = 60; // a staff override holds until the visitor walks this far away

export class TourEngine {
  // opts.requireFacing: false for devices with no usable compass; the scene
  // then shows on arrival + stillness alone.
  constructor(tour, opts = {}) {
    this.tour = tour;
    this.requireFacing = opts.requireFacing !== false;
    this.onEvent = opts.onEvent || (() => {});
    this.headingFilter = new HeadingFilter(opts.heading);
    this.stillness = new StillnessDetector({
      stillBelowMps: tour.safety.still_below_mps,
      stillForS: tour.safety.still_for_seconds,
      ...(opts.stillness || {}),
    });
    this.state = {
      pos: null, accuracy: null, speed: 0, error: null,
      raw: null, heading: null, calib: 0, headingSteady: true,
      still: false, moving: false,
      visited: new Set(), legIndex: 0, nextId: tour.stops[0].id,
      atStop: null, facing: false, showing: null, narrating: null, forced: null,
      done: false,
    };
  }

  // ------------------------------------------------------------ inputs

  location({ t, pos, accuracy, speed = null, error = null }) {
    const s = this.state;
    if (error) { s.error = error; return this.tick(t); }
    s.error = null;
    s.pos = pos;
    s.accuracy = accuracy;
    s.speed = this.stillness.gps({ t, pos, acc: accuracy, speed });
    return this.tick(t);
  }

  // raw compass heading, degrees from true north
  heading(raw, t) {
    const s = this.state;
    s.raw = this.headingFilter.push(raw, t);
    s.heading = norm(s.raw + s.calib);
    s.headingSteady = this.headingFilter.steady();
    return this.tick(t);
  }

  // |acceleration including gravity|, m/s^2
  motion(magnitude, t) {
    this.stillness.motion(t, magnitude);
  }

  // ------------------------------------------------------------ commands

  // "I'm facing it": the visitor is looking at the landmark, so the compass is off by this much.
  calibrate(t) {
    const s = this.state;
    if (!s.atStop || s.raw == null) return false;
    s.calib = turn(s.raw, targetBearing(s.atStop));
    s.heading = norm(s.raw + s.calib);
    this.tick(t);
    return true;
  }

  // staff override: show the scene here (or for the next stop) regardless of GPS/compass
  force(t) {
    const s = this.state;
    const stop = s.atStop || this.tour.stops.find((x) => x.id === s.nextId);
    if (!stop) return;
    s.forced = stop;
    this.tick(t);
  }

  skip(t) {
    const stop = this.tour.stops.find((x) => x.id === this.state.nextId);
    if (stop) this.finishStop(stop, t);
  }

  narrationEnded(stopId, t) {
    const stop = this.tour.stops.find((x) => x.id === stopId);
    if (stop && this.state.narrating === stopId) this.finishStop(stop, t);
  }

  // ------------------------------------------------------------ the loop

  tick(t) {
    const s = this.state;
    s.still = this.stillness.still(t);
    s.moving = this.stillness.moving();

    // Which stop are we inside? Prefer the next unvisited one.
    let at = null;
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
      const cut = s.narrating && this.tour.stops.find((x) => x.id === s.narrating);
      if (cut) {
        s.narrating = null;
        this.finishStop(cut, t);
        if (s.narrating || !s.showing || s.visited.has(s.showing.id)) return s; // finishStop re-ticked and handled it
      }
      s.narrating = s.showing.id;
      this.onEvent({ type: "narrate", stop: s.showing, t });
    }
    return s;
  }

  finishStop(stop, t) {
    const s = this.state;
    if (s.narrating === stop.id) s.narrating = null;
    s.visited.add(stop.id);
    s.forced = null;
    const i = this.tour.stops.findIndex((x) => x.id === stop.id);
    s.legIndex = Math.max(s.legIndex, i + 1);
    const next = this.tour.stops.find((x) => !s.visited.has(x.id));
    s.nextId = next ? next.id : null;
    this.onEvent({ type: "stop-done", stop, next, t });
    if (!next && !s.done) {
      s.done = true;
      this.onEvent({ type: "tour-done", t });
    }
    this.tick(t);
  }
}
