// Browser sensor adapters: raw, timestamped readings for the core. No
// filtering here; smoothing and stillness live in src/core so a replay goes
// through exactly the same logic as a live walk.

import { norm } from "../core/geo.ts";
import type {
  Clock,
  HeadingSource,
  LocationReading,
  LocationSource,
  MotionSource,
  Scheduler,
  Unsubscribe,
} from "../core/ports.ts";
import { isFix, isHeading, isMotion, TRACE_SCHEMA, type Trace } from "../core/replay.ts";
import type { SessionObserver } from "../core/session.ts";
import type { LatLon } from "../core/types.ts";

// ---------------------------------------------------------------- location

export class GeolocationSource implements LocationSource {
  private fixes: { t: number; pos: LatLon }[] = [];

  start(sink: (r: LocationReading) => void): Unsubscribe {
    if (!("geolocation" in navigator)) {
      sink({ t: Date.now(), error: "This browser has no location access." });
      return () => {};
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const t = Date.now();
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
        this.fixes.push({ t, pos });
        this.fixes = this.fixes.filter((f) => t - f.t < 8000);
        const speed = p.coords.speed == null || Number.isNaN(p.coords.speed) ? null : p.coords.speed;
        sink({ t, pos, accuracy: p.coords.accuracy, speed });
      },
      (e) => sink({ t: Date.now(), error: e.code === 1 ? "Location permission was denied." : "No GPS fix yet." }),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }

  /** Mean of the last few seconds of fixes (for placing stops on site). */
  averaged(): (LatLon & { n: number }) | null {
    const n = this.fixes.length;
    if (!n) return null;
    let lat = 0;
    let lon = 0;
    for (const f of this.fixes) {
      lat += f.pos.lat;
      lon += f.pos.lon;
    }
    return { lat: lat / n, lon: lon / n, n };
  }
}

// ---------------------------------------------------------------- heading

/**
 * Heading of the direction the BACK of the phone points (where its camera
 * looks), so it works with the phone held upright like a viewfinder.
 * W3C DeviceOrientation spec, "compass heading" worked example.
 */
export function backHeading(alpha: number, beta: number, gamma: number): number {
  const x = (beta * Math.PI) / 180;
  const y = (gamma * Math.PI) / 180;
  const z = (alpha * Math.PI) / 180;
  const vx = -Math.cos(z) * Math.sin(y) - Math.sin(z) * Math.sin(x) * Math.cos(y);
  const vy = -Math.sin(z) * Math.sin(y) + Math.cos(z) * Math.sin(x) * Math.cos(y);
  let h = Math.atan(vx / vy);
  if (vy < 0) h += Math.PI;
  else if (vx < 0) h += 2 * Math.PI;
  return (h * 180) / Math.PI;
}

interface IOSOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

type PermissionCtor = { requestPermission?: () => Promise<"granted" | "denied"> };

export class CompassSource implements HeadingSource {
  /** "iOS compass" | "Android compass" once readings arrive */
  kind: string | null = null;

  /** iOS asks for motion-sensor permission, and only inside a tap. */
  async request(): Promise<string | null> {
    for (const D of [window.DeviceOrientationEvent, window.DeviceMotionEvent] as unknown as PermissionCtor[]) {
      if (D && typeof D.requestPermission === "function") {
        try {
          if ((await D.requestPermission()) !== "granted") return "Compass permission was denied.";
        } catch {
          return "Compass permission needs a tap.";
        }
      }
    }
    return null;
  }

  start(sink: (deg: number, t: number) => void): Unsubscribe {
    const handle = (ev: Event): void => {
      const e = ev as IOSOrientationEvent;
      let h: number;
      if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
        h = e.webkitCompassHeading; // iOS: already a compass heading
        this.kind = "iOS compass";
      } else if ((e.absolute || e.type === "deviceorientationabsolute") && e.alpha != null) {
        const beta = e.beta ?? 0;
        h =
          Math.abs(beta) > 45
            ? backHeading(e.alpha, beta, e.gamma ?? 0)
            : norm(360 - e.alpha + (screen.orientation?.angle ?? 0));
        this.kind = "Android compass";
      } else return; // relative-only orientation is no use for facing a landmark
      sink(h, Date.now());
    };
    const abs = "ondeviceorientationabsolute" in window;
    if (abs) window.addEventListener("deviceorientationabsolute", handle);
    window.addEventListener("deviceorientation", handle);
    return () => {
      if (abs) window.removeEventListener("deviceorientationabsolute", handle);
      window.removeEventListener("deviceorientation", handle);
    };
  }
}

export class AccelerometerSource implements MotionSource {
  start(sink: (a: number, t: number) => void): Unsubscribe {
    let last = 0;
    const handle = (e: DeviceMotionEvent): void => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const t = Date.now();
      if (t - last < 50) return; // 20 Hz is plenty to see footsteps
      last = t;
      sink(Math.hypot(a.x, a.y, a.z), t);
    };
    window.addEventListener("devicemotion", handle);
    return () => window.removeEventListener("devicemotion", handle);
  }
}

// ---------------------------------------------------------------- simulator

/** Tap-the-map position and a slider heading, for demos off site. */
export class SimulatedSensors implements LocationSource {
  pos: LatLon;
  heading = 180;
  private loc: ((r: LocationReading) => void) | null = null;
  private head: ((d: number, t: number) => void) | null = null;

  constructor(start: LatLon) {
    this.pos = { ...start };
  }

  start(sink: (r: LocationReading) => void): Unsubscribe {
    this.loc = sink;
    return () => (this.loc = null);
  }

  readonly heading$: HeadingSource = {
    start: (sink) => {
      this.head = sink;
      return () => (this.head = null);
    },
  };

  set(pos: LatLon, speed = 0): void {
    this.pos = pos;
    this.loc?.({ t: Date.now(), pos, accuracy: 4, speed });
  }

  face(h: number): void {
    this.heading = norm(h);
    this.head?.(this.heading, Date.now());
  }

  averaged(): LatLon & { n: number } {
    return { ...this.pos, n: 1 };
  }
}

// ---------------------------------------------------------------- replay

/**
 * Plays a trace through the three source interfaces on a virtual clock that
 * runs `speedup` times real time. Use its `clock` as the session's clock.
 */
export class ReplaySources {
  readonly clock: Clock;
  readonly location: LocationSource;
  readonly heading: HeadingSource;
  readonly motion: MotionSource;
  private loc: ((r: LocationReading) => void) | null = null;
  private head: ((d: number, t: number) => void) | null = null;
  private mot: ((a: number, t: number) => void) | null = null;
  private t0 = 0;
  private i = 0;
  private readonly trace: Trace;
  private readonly speedup: number;

  constructor(trace: Trace, speedup: number, scheduler: Scheduler) {
    this.trace = trace;
    this.speedup = speedup;
    this.clock = { now: () => (this.t0 ? (Date.now() - this.t0) * this.speedup : 0) };
    this.location = { start: (s) => ((this.loc = s), () => (this.loc = null)) };
    this.heading = { start: (s) => ((this.head = s), () => (this.head = null)) };
    this.motion = { start: (s) => ((this.mot = s), () => (this.mot = null)) };
    scheduler.every(50, () => this.pump());
  }

  begin(): void {
    this.t0 = Date.now();
  }

  private pump(): void {
    if (!this.t0) return;
    const now = this.clock.now();
    for (let x = this.trace.samples[this.i]; x && x.t <= now; x = this.trace.samples[++this.i]) {
      if (isFix(x))
        this.loc?.({ t: x.t, pos: { lat: x.lat, lon: x.lon }, accuracy: x.acc ?? 5, speed: x.speed ?? null });
      else if (isHeading(x)) this.head?.(x.heading, x.t);
      else if (isMotion(x)) this.mot?.(x.a, x.t);
    }
  }

  get finished(): boolean {
    return this.i >= this.trace.samples.length;
  }
}

// ---------------------------------------------------------------- recorder

/** Records a real walk as ori.trace/1, so a walk at the park becomes a regression test. */
export class Recorder implements SessionObserver {
  private readonly t0 = Date.now();
  private readonly samples: Trace["samples"] = [];
  private lastHeading = 0;
  private lastMotion = 0;
  private readonly tourId: string;

  constructor(tourId: string) {
    this.tourId = tourId;
  }

  location(r: LocationReading): void {
    if (r.error !== undefined) return;
    this.samples.push({
      t: r.t - this.t0,
      lat: +r.pos.lat.toFixed(7),
      lon: +r.pos.lon.toFixed(7),
      acc: Math.round(r.accuracy),
      speed: r.speed,
    });
  }

  heading(h: number, t: number): void {
    if (t - this.lastHeading < 100) return;
    this.lastHeading = t;
    this.samples.push({ t: t - this.t0, heading: +h.toFixed(1) });
  }

  motion(a: number, t: number): void {
    if (t - this.lastMotion < 50) return;
    this.lastMotion = t;
    this.samples.push({ t: t - this.t0, a: +a.toFixed(3) });
  }

  get fixes(): number {
    return this.samples.filter(isFix).length;
  }

  file(note: string): Trace {
    return {
      schema: TRACE_SCHEMA,
      tour: this.tourId,
      source: "recorded",
      recorded: new Date(this.t0).toISOString(),
      device: navigator.userAgent,
      note,
      samples: this.samples,
    };
  }
}
