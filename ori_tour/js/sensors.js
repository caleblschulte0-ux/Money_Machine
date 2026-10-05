// Position and heading sources. The tour reads only {pos, accuracy, speed, heading},
// so a phone, a pair of glasses or the simulator can feed it the same way.

import { distance, norm } from "./geo.js";

// ---------------------------------------------------------------- location

export class LiveLocation {
  constructor(onChange) {
    this.onChange = onChange;
    this.fixes = [];
    this.state = { pos: null, accuracy: null, speed: null, error: null };
  }

  start() {
    if (!("geolocation" in navigator)) {
      this.state.error = "This browser has no location access.";
      this.onChange(this.state);
      return;
    }
    this.watch = navigator.geolocation.watchPosition(
      (p) => this.fix(p),
      (e) => {
        this.state.error = e.code === 1 ? "Location permission was denied." : "No GPS fix yet.";
        this.onChange(this.state);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
    );
  }

  fix(p) {
    const now = p.timestamp || Date.now();
    const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
    this.fixes.push({ t: now, pos, acc: p.coords.accuracy });
    this.fixes = this.fixes.filter((f) => now - f.t < 8000);
    let speed = p.coords.speed;
    if (speed == null || Number.isNaN(speed)) {
      // No Doppler speed from the device: estimate over ~5 s, and only trust
      // movement larger than the GPS error, so jitter does not read as walking.
      const old = this.fixes.find((f) => now - f.t >= 4000);
      if (old) {
        const d = distance(old.pos, pos);
        speed = d > Math.max(p.coords.accuracy, old.acc) * 0.6 ? d / ((now - old.t) / 1000) : 0;
      } else speed = 0;
    }
    this.state = { pos, accuracy: p.coords.accuracy, speed, error: null };
    this.onChange(this.state);
  }

  // Mean of recent fixes, for placing a stop in site-walk mode.
  averaged() {
    if (!this.fixes.length) return null;
    const n = this.fixes.length;
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

export class LiveHeading {
  constructor(onChange) {
    this.onChange = onChange;
    this.raw = null;
    this.sx = 0;
    this.sy = 0;
    this.source = null;
  }

  // Must run inside a tap on iOS.
  async request() {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === "function") {
      try {
        if ((await D.requestPermission()) !== "granted") return "Compass permission was denied.";
      } catch (e) {
        return "Compass permission needs a tap.";
      }
    }
    return null;
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
    } else if ((e.absolute || e.type === "deviceorientationabsolute") && e.alpha != null) {
      if (Math.abs(e.beta) > 45) h = backHeading(e.alpha, e.beta, e.gamma);
      else h = norm(360 - e.alpha + ((screen.orientation && screen.orientation.angle) || 0));
      this.source = "Android compass";
    } else return; // relative-only orientation is no use for facing a landmark
    // Smooth on the unit circle so 359 -> 1 does not swing through 180.
    const k = this.raw == null ? 1 : 0.2;
    this.sx = this.sx * (1 - k) + Math.sin((h * Math.PI) / 180) * k;
    this.sy = this.sy * (1 - k) + Math.cos((h * Math.PI) / 180) * k;
    this.raw = norm((Math.atan2(this.sx, this.sy) * 180) / Math.PI);
    this.onChange(this.raw);
  }
}

// ---------------------------------------------------------------- simulator

export class SimSensors {
  constructor(start, onLocation, onHeading) {
    this.onLocation = onLocation;
    this.onHeading = onHeading;
    this.pos = { ...start };
    this.heading = 180;
    this.speed = 0;
  }
  set(pos, speed = 0) {
    this.pos = pos;
    this.speed = speed;
    this.onLocation({ pos, accuracy: 4, speed, error: null });
  }
  face(h) {
    this.heading = norm(h);
    this.onHeading(this.heading);
  }
  averaged() {
    return { ...this.pos, n: 1 };
  }
}
