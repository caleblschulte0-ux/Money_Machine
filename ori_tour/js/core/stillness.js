// Is the visitor standing still? Pure: fed GPS fixes and (when the device
// has them) accelerometer samples, asked with an explicit clock.
//
// Pictures only appear when the visitor is still, so this is a safety rule,
// not a nicety. Two signals, because neither is good alone:
//
//   - GPS speed lags by seconds and, standing still, wanders at 0.2-1 m/s as
//     the fix jitters. Without device speed we estimate it over ~6 s from averaged
//     fixes and only count movement bigger than the fix's own error.
//   - The accelerometer sees every footstep (1.5-3 m/s^2 of bounce) within a
//     second, and reads flat when the visitor stops. Glasses and phones both
//     have one; a replay may not.
//
// When recent accelerometer data exists it decides, and GPS can only add
// "moving" when it is clearly moving (faster than a slow walk). Without it,
// GPS decides alone. Becoming still always takes `stillForS` of unbroken
// stillness; becoming moving is immediate.

import { distance } from "./geo.js";

export const STILL_DEFAULTS = {
  stillBelowMps: 0.7, // tour.safety.still_below_mps
  stillForS: 2, // tour.safety.still_for_seconds
  gpsWindowMs: 6000, // estimate speed over this window when the device gives none
  gpsSpanMs: 3000, // minimum history before estimating
  gpsClearlyMovingMps: 1.6,
  motionWindowMs: 1500,
  motionStaleMs: 2500,
  stepStd: 0.8, // m/s^2 spread of |a| that reads as walking
  quietStd: 0.35, // below this the body is still
};

function mean(fs) {
  const n = fs.length;
  return {
    t: fs.reduce((s, f) => s + f.t, 0) / n,
    acc: fs.reduce((s, f) => s + (f.acc || 0), 0) / n,
    pos: { lat: fs.reduce((s, f) => s + f.pos.lat, 0) / n, lon: fs.reduce((s, f) => s + f.pos.lon, 0) / n },
  };
}

export class StillnessDetector {
  constructor(opts = {}) {
    this.o = { ...STILL_DEFAULTS, ...opts };
    this.fixes = [];
    this.accel = [];
    this.speed = 0;
    this.motionMoving = null; // null: no opinion yet
    this.lastMotionT = null;
    this.movingNow = false;
    this.stillSince = null;
  }

  // fix: {t, pos:{lat,lon}, acc, speed?}  Returns the speed used, m/s.
  gps(fix) {
    const { t } = fix;
    this.fixes.push(fix);
    while (this.fixes.length && t - this.fixes[0].t > this.o.gpsWindowMs) this.fixes.shift();
    let speed = fix.speed;
    if (speed == null || Number.isNaN(speed)) {
      // Compare the average of the oldest fixes with the average of the newest,
      // which cancels much of the jitter a single pair of fixes would show.
      const first = this.fixes[0];
      if (t - first.t >= this.o.gpsSpanMs) {
        const third = (t - first.t) / 3;
        const a = mean(this.fixes.filter((f) => f.t - first.t <= third));
        const b = mean(this.fixes.filter((f) => t - f.t <= third));
        const d = distance(a.pos, b.pos);
        const noise = Math.max(a.acc, b.acc) * 0.6;
        speed = d > noise ? d / Math.max(0.5, (b.t - a.t) / 1000) : 0;
      } else speed = this.speed; // not enough history: keep what we had
    }
    this.speed = speed;
    this.update(t);
    return speed;
  }

  // magnitude of acceleration including gravity, m/s^2 (gravity cancels in the spread)
  motion(t, magnitude) {
    this.accel.push({ t, a: magnitude });
    while (this.accel.length && t - this.accel[0].t > this.o.motionWindowMs) this.accel.shift();
    this.lastMotionT = t;
    if (this.accel.length >= 8) {
      const n = this.accel.length;
      const mean = this.accel.reduce((s, x) => s + x.a, 0) / n;
      const std = Math.sqrt(this.accel.reduce((s, x) => s + (x.a - mean) ** 2, 0) / n);
      if (std >= this.o.stepStd) this.motionMoving = true;
      else if (std <= this.o.quietStd) this.motionMoving = false;
      // in between: keep the previous call (hysteresis)
    }
    this.update(t);
  }

  hasMotion(t) {
    return this.lastMotionT != null && t - this.lastMotionT < this.o.motionStaleMs && this.motionMoving != null;
  }

  update(t) {
    let moving;
    if (this.hasMotion(t)) moving = this.motionMoving || this.speed >= this.o.gpsClearlyMovingMps;
    else moving = this.speed >= this.o.stillBelowMps;
    this.movingNow = moving;
    if (moving) this.stillSince = null;
    else if (this.stillSince == null) this.stillSince = t;
  }

  // Still long enough for pictures?
  still(t) {
    if (this.lastMotionT != null && !this.hasMotion(t) && this.motionMoving != null) {
      // motion went stale: fall back to GPS from here on
      this.motionMoving = null;
      this.update(t);
    }
    return !this.movingNow && this.stillSince != null && t - this.stillSince >= this.o.stillForS * 1000;
  }

  moving() {
    return this.movingNow;
  }
}
