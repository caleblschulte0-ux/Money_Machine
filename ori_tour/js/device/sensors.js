// Device adapters: turn browser sensor APIs into the raw, timestamped readings
// the core engine takes. No filtering here: smoothing and stillness live in
// js/core so a replay goes through exactly the same logic as a live walk.
//
//   location: {t, pos, accuracy, speed|null} or {t, error}
//   heading:  (degrees from true north, t)
//   motion:   (|acceleration incl. gravity| m/s^2, t)

import { norm } from "../core/geo.js";
import { TRACE_SCHEMA } from "../core/replay.js";

// ---------------------------------------------------------------- location

export class LiveLocation {
  constructor(onFix) {
    this.onFix = onFix;
    this.fixes = [];
  }

  start() {
    if (!("geolocation" in navigator)) {
      this.onFix({ t: Date.now(), error: "This browser has no location access." });
      return;
    }
    this.watch = navigator.geolocation.watchPosition(
      (p) => this.fix(p),
      (e) => this.onFix({ t: Date.now(), error: e.code === 1 ? "Location permission was denied." : "No GPS fix yet." }),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
    );
  }

  fix(p) {
    const t = Date.now();
    const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
    const speed = p.coords.speed == null || Number.isNaN(p.coords.speed) ? null : p.coords.speed;
    this.fixes.push({ t, pos });
    this.fixes = this.fixes.filter((f) => t - f.t < 8000);
    this.onFix({ t, pos, accuracy: p.coords.accuracy, speed });
  }

  // Mean of recent fixes, for placing a stop in site-walk mode.
  averaged() {
    const n = this.fixes.length;
    if (!n) return null;
    return {
      lat: this.fixes.reduce((s, f) => s + f.pos.lat, 0) / n,
      lon: this.fixes.reduce((s, f) => s + f.pos.lon, 0) / n,
      n,
    };
  }
}

// ---------------------------------------------------------------- heading

// Heading of the direction the BACK of the phone points (where its camera
// looks), so it works with the phone held upright like a viewfinder.
// W3C DeviceOrientation spec, "compass heading" worked example.
function backHeading(alpha, beta, gamma) {
  const x = (beta || 0) * (Math.PI / 180);
  const y = (gamma || 0) * (Math.PI / 180);
  const z = (alpha || 0) * (Math.PI / 180);
  const vx = -Math.cos(z) * Math.sin(y) - Math.sin(z) * Math.sin(x) * Math.cos(y);
  const vy = -Math.sin(z) * Math.sin(y) + Math.cos(z) * Math.sin(x) * Math.cos(y);
  let h = Math.atan(vx / vy);
  if (vy < 0) h += Math.PI;
  else if (vx < 0) h += 2 * Math.PI;
  return (h * 180) / Math.PI;
}

// Asks for motion-sensor permission where the browser requires it (iOS).
// Must run inside a tap. Returns an error sentence or null.
export async function requestMotionPermission() {
  for (const D of [window.DeviceOrientationEvent, window.DeviceMotionEvent]) {
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

export class LiveHeading {
  constructor(onHeading) {
    this.onHeading = onHeading;
    this.source = null;
    this.accuracy = null; // iOS reports compass accuracy in degrees
  }

  start() {
    const handle = (e) => this.event(e);
    if ("ondeviceorientationabsolute" in window) window.addEventListener("deviceorientationabsolute", handle);
    window.addEventListener("deviceorientation", handle);
  }

  event(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
      h = e.webkitCompassHeading; // iOS: already a compass heading
      this.source = "iOS compass";
      this.accuracy = e.webkitCompassAccuracy;
    } else if ((e.absolute || e.type === "deviceorientationabsolute") && e.alpha != null) {
      if (Math.abs(e.beta) > 45) h = backHeading(e.alpha, e.beta, e.gamma);
      else h = norm(360 - e.alpha + ((screen.orientation && screen.orientation.angle) || 0));
      this.source = "Android compass";
    } else return; // relative-only orientation is no use for facing a landmark
    this.onHeading(h, Date.now());
  }
}

export class LiveMotion {
  constructor(onMotion) {
    this.onMotion = onMotion;
    this.last = 0;
  }
  start() {
    window.addEventListener("devicemotion", (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      const t = Date.now();
      if (t - this.last < 50) return; // 20 Hz is plenty to see footsteps
      this.last = t;
      this.onMotion(Math.hypot(a.x, a.y, a.z), t);
    });
  }
}

// ---------------------------------------------------------------- simulator

export class SimSensors {
  constructor(start, onFix, onHeading) {
    this.onFix = onFix;
    this.onHeading = onHeading;
    this.pos = { ...start };
    this.heading = 180;
  }
  set(pos, speed = 0) {
    this.pos = pos;
    this.onFix({ t: Date.now(), pos, accuracy: 4, speed });
  }
  face(h) {
    this.heading = norm(h);
    this.onHeading(this.heading, Date.now());
  }
  averaged() {
    return { ...this.pos, n: 1 };
  }
}

// ---------------------------------------------------------------- recorder

// Records a real walk (?record=1) as an ori.trace/1 file the replay and the
// tests can play back. This is how a walk at the park becomes a regression test.
export class Recorder {
  constructor(tourId) {
    this.tourId = tourId;
    this.t0 = Date.now();
    this.samples = [];
    this.lastHeading = 0;
  }
  fix(f) {
    if (f.error || !f.pos) return;
    this.samples.push({ t: f.t - this.t0, lat: +f.pos.lat.toFixed(7), lon: +f.pos.lon.toFixed(7), acc: Math.round(f.accuracy), speed: f.speed });
  }
  heading(h, t) {
    if (t - this.lastHeading < 100) return;
    this.lastHeading = t;
    this.samples.push({ t: t - this.t0, heading: +h.toFixed(1) });
  }
  motion(a, t) {
    this.samples.push({ t: t - this.t0, a: +a.toFixed(3) });
  }
  get gpsCount() {
    return this.samples.filter((s) => s.lat != null).length;
  }
  file() {
    return {
      schema: TRACE_SCHEMA,
      tour: this.tourId,
      source: "recorded",
      recorded: new Date(this.t0).toISOString(),
      device: navigator.userAgent,
      note: "Recorded on site with ?record=1.",
      samples: this.samples,
    };
  }
}
