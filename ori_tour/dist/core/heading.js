// Compass smoothing. Pure: a replay or a test feeds it exactly as a device does.
//
// A raw compass near railings and stone jumps around: single-sample spikes of
// 40-90 degrees and a few degrees of constant jitter. The facing gate needs a
// heading that is steady while the visitor stands still and still follows
// them promptly when they turn. So:
//
//   1. Spike rejection: a sample far from the smoothed heading is held back
//      until a second sample agrees with it. A real turn produces a run of
//      agreeing samples; a spike does not.
//   2. Time-based smoothing on the unit circle (359 -> 1 never swings through
//      180), with a time constant that shortens while the heading is moving.
//   3. A steadiness measure (circular spread over the last two seconds) the
//      UI uses to suggest calibrating.
import { norm, turn } from "./geo.js";
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
export const HEADING_DEFAULTS = {
    tauStillMs: 450,
    tauTurnMs: 120,
    turnRateDegS: 45,
    spikeDeg: 35,
    confirmDeg: 20,
    windowMs: 2000,
    unsteadyDeg: 20,
};
export class HeadingFilter {
    o;
    /** Smoothed heading, degrees; null before the first reading. */
    value = null;
    t = 0;
    pending = null;
    /** Turn rate, deg/s, smoothed. */
    rate = 0;
    recent = [];
    constructor(opts = {}) {
        this.o = { ...HEADING_DEFAULTS, ...opts };
    }
    reset() {
        this.value = null;
        this.pending = null;
        this.rate = 0;
        this.recent = [];
    }
    /** Feed one raw reading (degrees, ms). Returns the smoothed heading. */
    push(raw, t) {
        const h = norm(raw);
        if (this.value == null) {
            this.value = h;
            this.t = t;
            this.recent = [{ t, h }];
            return h;
        }
        const off = Math.abs(turn(this.value, h));
        if (off > this.o.spikeDeg) {
            if (!this.pending || Math.abs(turn(this.pending.h, h)) > this.o.confirmDeg) {
                this.pending = { h, t };
                return this.value; // a lone spike never moves the heading
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
        while (this.recent.length && t - (this.recent[0]?.t ?? t) > this.o.windowMs)
            this.recent.shift();
    }
    /** Circular standard deviation of recent raw samples, degrees. Low = steady. */
    spread() {
        const n = this.recent.length;
        if (n < 3)
            return 0;
        let sx = 0;
        let cy = 0;
        for (const r of this.recent) {
            sx += Math.sin(rad(r.h));
            cy += Math.cos(rad(r.h));
        }
        const R = Math.min(1, Math.hypot(sx, cy) / n);
        return deg(Math.sqrt(-2 * Math.log(Math.max(R, 1e-9))));
    }
    /** Steady enough to trust for the facing gate? Turning is not unsteady. */
    steady() {
        return this.rate > this.o.turnRateDegS || this.spread() <= this.o.unsteadyDeg;
    }
}
