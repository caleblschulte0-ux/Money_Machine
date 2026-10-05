// Compass smoothing. Pure: no DOM, so a replay or a test feeds it the same
// way a phone does.
//
// A raw phone compass near railings and stone jumps around: single-sample
// spikes of 40-90 degrees, and a few degrees of constant jitter. The facing
// gate needs a heading that is steady while the visitor stands still and
// still follows them promptly when they turn. So:
//
//   1. Spike rejection: a sample far from the smoothed heading is held back
//      until a second sample agrees with it. A real turn produces a run of
//      agreeing samples; a spike does not.
//   2. Time-based smoothing on the unit circle (359 -> 1 never swings through
//      180), with a time constant that shortens while the heading is moving,
//      so a deliberate turn is followed within a fraction of a second.
//   3. A steadiness measure (circular spread over the last two seconds) the
//      UI can use to say "compass unsteady: calibrate".

import { norm, turn } from "./geo.js";

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export const HEADING_DEFAULTS = {
  tauStillMs: 450, // smoothing time constant while the heading is steady
  tauTurnMs: 120, // while the visitor is turning
  turnRateDegS: 45, // above this the visitor is turning
  spikeDeg: 35, // a sample this far off is suspect until confirmed
  confirmDeg: 20, // a second sample within this of the first confirms it
  windowMs: 2000, // steadiness window
  unsteadyDeg: 20, // circular spread above this reads as unsteady
};

export class HeadingFilter {
  constructor(opts = {}) {
    this.o = { ...HEADING_DEFAULTS, ...opts };
    this.reset();
  }

  reset() {
    this.value = null; // smoothed heading, degrees
    this.t = null;
    this.pending = null; // a suspect sample awaiting confirmation
    this.rate = 0; // deg/s, smoothed
    this.recent = []; // [{t, h}] accepted samples, for steadiness
  }

  // Feed one raw reading. Returns the smoothed heading (or null before the first).
  push(h, t) {
    h = norm(h);
    if (this.value == null) {
      this.value = h;
      this.t = t;
      this.recent = [{ t, h }];
      return this.value;
    }
    const off = Math.abs(turn(this.value, h));
    if (off > this.o.spikeDeg) {
      if (!this.pending || Math.abs(turn(this.pending.h, h)) > this.o.confirmDeg) {
        this.pending = { h, t };
        return this.value; // hold: a lone spike never moves the heading
      }
      // confirmed: the visitor really turned. Jump most of the way there.
      this.pending = null;
      const dt = Math.max(1, t - this.t);
      this.rate = Math.min(720, (off / dt) * 1000);
      this.value = norm(h + turn(h, this.value) * 0.25);
      this.t = t;
      this.remember(h, t);
      return this.value;
    }
    this.pending = null;
    const dt = Math.max(0, t - this.t);
    const step = turn(this.value, h);
    const instRate = dt > 0 ? (Math.abs(step) / dt) * 1000 : 0;
    this.rate = this.rate * 0.7 + instRate * 0.3;
    const tau = this.rate > this.o.turnRateDegS ? this.o.tauTurnMs : this.o.tauStillMs;
    const k = dt <= 0 ? 0.5 : 1 - Math.exp(-dt / tau);
    const sx = Math.sin(rad(this.value)) * (1 - k) + Math.sin(rad(h)) * k;
    const cy = Math.cos(rad(this.value)) * (1 - k) + Math.cos(rad(h)) * k;
    this.value = norm(deg(Math.atan2(sx, cy)));
    this.t = t;
    this.remember(h, t);
    return this.value;
  }

  remember(h, t) {
    this.recent.push({ t, h });
    while (this.recent.length && t - this.recent[0].t > this.o.windowMs) this.recent.shift();
  }

  // Circular standard deviation of recent raw samples, in degrees. Low = steady.
  spread() {
    const n = this.recent.length;
    if (n < 3) return 0;
    let sx = 0, cy = 0;
    for (const r of this.recent) { sx += Math.sin(rad(r.h)); cy += Math.cos(rad(r.h)); }
    const R = Math.min(1, Math.hypot(sx, cy) / n);
    return deg(Math.sqrt(-2 * Math.log(Math.max(R, 1e-9))));
  }

  // Steady enough to trust for the facing gate? Turning is not unsteady.
  steady() {
    return this.rate > this.o.turnRateDegS || this.spread() <= this.o.unsteadyDeg;
  }
}
