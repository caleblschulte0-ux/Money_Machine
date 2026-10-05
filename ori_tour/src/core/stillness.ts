// Is the visitor standing still? Pure: fed GPS fixes and (when the device has
// them) accelerometer samples, asked with an explicit clock.
//
// Pictures only appear when the visitor is still, so this is a safety rule,
// not a nicety. Two signals, because neither is good alone:
//
//   - GPS speed lags by seconds and, standing still, wanders at 0.2-1 m/s as
//     the fix jitters. Without device speed we estimate it over ~6 s from
//     averaged fixes and only count movement bigger than the fix's own error.
//   - The accelerometer sees every footstep (1.5-3 m/s^2 of bounce) within a
//     second, and reads flat when the visitor stops. Phones and most glasses
//     have one; a replay may not.
//
// When recent accelerometer data exists it decides, and GPS can only add
// "moving" when it is clearly moving. Without it, GPS decides alone. Becoming
// still takes `stillForS` of unbroken stillness; becoming moving is immediate.

import { distance } from "./geo.ts";
import type { LatLon } from "./types.ts";

export interface StillnessOptions {
  /** tour.safety.still_below_mps */
  stillBelowMps: number;
  /** tour.safety.still_for_seconds */
  stillForS: number;
  /** estimate speed over this window when the device gives none, ms */
  gpsWindowMs: number;
  /** minimum history before estimating, ms */
  gpsSpanMs: number;
  /**
   * No new fix for this long means no movement: phones (iOS especially) stop
   * sending fixes when the position stops changing, so the last speed would
   * otherwise read "walking" forever.
   */
  gpsStaleMs: number;
  /** with an accelerometer, GPS only overrides above this speed */
  gpsClearlyMovingMps: number;
  motionWindowMs: number;
  motionStaleMs: number;
  /** spread of |a| that reads as walking, m/s^2 */
  stepStd: number;
  /** below this the body is still, m/s^2 */
  quietStd: number;
}

export const STILL_DEFAULTS: Readonly<StillnessOptions> = {
  stillBelowMps: 0.7,
  stillForS: 2,
  gpsWindowMs: 6000,
  gpsSpanMs: 3000,
  gpsStaleMs: 3000,
  gpsClearlyMovingMps: 1.6,
  motionWindowMs: 1500,
  motionStaleMs: 2500,
  stepStd: 0.8,
  quietStd: 0.35,
};

export interface GpsFix {
  t: number;
  pos: LatLon;
  acc: number;
  speed?: number | null;
}

interface Averaged {
  t: number;
  acc: number;
  pos: LatLon;
}

function mean(fs: GpsFix[]): Averaged {
  const n = fs.length;
  let t = 0;
  let acc = 0;
  let lat = 0;
  let lon = 0;
  for (const f of fs) {
    t += f.t;
    acc += f.acc || 0;
    lat += f.pos.lat;
    lon += f.pos.lon;
  }
  return { t: t / n, acc: acc / n, pos: { lat: lat / n, lon: lon / n } };
}

export class StillnessDetector {
  private readonly o: StillnessOptions;
  private fixes: GpsFix[] = [];
  private accel: { t: number; a: number }[] = [];
  /** Speed in use, m/s. */
  speed = 0;
  private motionMoving: boolean | null = null;
  private lastMotionT: number | null = null;
  private movingNow = false;
  private stillSince: number | null = null;

  constructor(opts: Partial<StillnessOptions> = {}) {
    this.o = { ...STILL_DEFAULTS, ...opts };
  }

  /** Feed a GPS fix. Returns the speed used, m/s. */
  gps(fix: GpsFix): number {
    const { t } = fix;
    this.fixes.push(fix);
    while (this.fixes.length && t - (this.fixes[0]?.t ?? t) > this.o.gpsWindowMs) this.fixes.shift();
    let speed = fix.speed;
    if (speed == null || Number.isNaN(speed)) {
      // Average the oldest third against the newest third: cancels much of the
      // jitter a single pair of fixes would show.
      const first = this.fixes[0];
      if (first && t - first.t >= this.o.gpsSpanMs) {
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

  /** Feed |acceleration including gravity|, m/s^2 (gravity cancels in the spread). */
  motion(t: number, magnitude: number): void {
    this.accel.push({ t, a: magnitude });
    while (this.accel.length && t - (this.accel[0]?.t ?? t) > this.o.motionWindowMs) this.accel.shift();
    this.lastMotionT = t;
    if (this.accel.length >= 8) {
      const n = this.accel.length;
      const avg = this.accel.reduce((s, x) => s + x.a, 0) / n;
      const std = Math.sqrt(this.accel.reduce((s, x) => s + (x.a - avg) ** 2, 0) / n);
      if (std >= this.o.stepStd) this.motionMoving = true;
      else if (std <= this.o.quietStd) this.motionMoving = false;
      // in between: keep the previous call (hysteresis)
    }
    this.update(t);
  }

  private hasMotion(t: number): boolean {
    return this.lastMotionT != null && t - this.lastMotionT < this.o.motionStaleMs && this.motionMoving != null;
  }

  private update(t: number): void {
    const moving = this.hasMotion(t)
      ? this.motionMoving === true || this.speed >= this.o.gpsClearlyMovingMps
      : this.speed >= this.o.stillBelowMps;
    this.movingNow = moving;
    if (moving) this.stillSince = null;
    else if (this.stillSince == null) this.stillSince = t;
  }

  /** Still long enough for pictures? */
  still(t: number): boolean {
    const lastFix = this.fixes[this.fixes.length - 1];
    if (lastFix && this.speed > 0 && t - lastFix.t > this.o.gpsStaleMs) {
      this.speed = 0; // fixes stopped coming: the position is not changing
      this.update(t);
    }
    if (this.lastMotionT != null && this.motionMoving != null && !this.hasMotion(t)) {
      this.motionMoving = null; // accelerometer went quiet: GPS decides from here on
      this.update(t);
    }
    return !this.movingNow && this.stillSince != null && t - this.stillSince >= this.o.stillForS * 1000;
  }

  moving(): boolean {
    return this.movingNow;
  }

  /** Which signal is deciding right now (for the sensor readout). */
  source(t: number): "motion" | "gps" {
    return this.hasMotion(t) ? "motion" : "gps";
  }
}
