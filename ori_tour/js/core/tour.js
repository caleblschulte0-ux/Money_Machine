// The content package: loading, checking, and on-site placement edits.
// Pure apart from the injectable fetch, so Node tests use the same code.

import { distance, bearing, ll } from "./geo.js";

export const SCHEMA = "ori.tour/1";

// Every problem with a package, as plain sentences. Empty means usable.
export function validateTour(tour) {
  const errs = [];
  if (tour.schema !== SCHEMA) errs.push(`schema is ${tour.schema}, expected ${SCHEMA}`);
  if (!tour.start || !tour.start.position) errs.push("no start position");
  if (!Array.isArray(tour.stops) || !tour.stops.length) errs.push("no stops");
  for (const k of ["still_below_mps", "still_for_seconds"]) {
    if (typeof tour.safety?.[k] !== "number") errs.push(`safety.${k} missing`);
  }
  const ids = new Set();
  for (const s of tour.stops || []) {
    const at = `stop ${s.id || "?"}`;
    if (!s.id) errs.push("a stop has no id");
    if (ids.has(s.id)) errs.push(`${at}: duplicate id`);
    ids.add(s.id);
    if (!s.position || typeof s.position.lat !== "number") errs.push(`${at}: no position`);
    if (!(s.radius_m > 0)) errs.push(`${at}: radius_m must be positive`);
    if (!s.facing || (!s.facing.target && s.facing.bearing_deg == null)) errs.push(`${at}: facing needs a target or bearing_deg`);
    if (!(s.facing?.tolerance_deg > 0)) errs.push(`${at}: facing.tolerance_deg must be positive`);
    if (!s.narration || !s.narration.text) errs.push(`${at}: no narration text`);
    if (!s.narration?.review) errs.push(`${at}: narration.review must say its review status`);
    if (!s.scene || !s.scene.title) errs.push(`${at}: no scene title`);
    if (!Array.isArray(s.sources)) errs.push(`${at}: sources must be a list (empty is honest, missing is not)`);
  }
  return errs;
}

export const targetBearing = (s) => (s.facing.bearing_deg != null ? s.facing.bearing_deg : bearing(s.position, s.facing.target));

// Resolve the package's relative asset paths against where it was loaded from.
export function prepareTour(tour, map, base = "") {
  for (const s of tour.stops) {
    const n = s.narration;
    if (n.audio) n.audio = base + n.audio;
    if (n.cues) n.cues = base + n.cues;
    if (s.scene.image) s.scene.image = base + s.scene.image;
    for (const layer of s.scene.layers || []) if (layer.src) layer.src = base + layer.src;
  }
  tour.stops.sort((a, b) => a.order - b.order);
  return { tour, map };
}

export async function loadTour(base, fetchJson = (u) => fetch(u).then((r) => r.json())) {
  const [tour, map] = await Promise.all([fetchJson(base + "tour.json"), fetchJson(base + "map.json")]);
  const errs = validateTour(tour);
  if (errs.length) throw new Error("Tour package problems: " + errs.join("; "));
  return prepareTour(tour, map, base);
}

// Apply on-site placements ({stopId: {position?, bearing?}}) made in site-walk
// mode. Returns true if anything changed. A moved stop no longer matches its
// pre-routed path, so its legs fall back to straight guide lines.
export function applyPlacements(tour, map, edits) {
  if (!edits) return false;
  let changed = false;
  for (const s of tour.stops) {
    const e = edits[s.id];
    if (!e) continue;
    if (e.position) s.position = e.position;
    if (e.bearing != null) s.facing.bearing_deg = e.bearing;
    changed = true;
  }
  const pts = [tour.start.position, ...tour.stops.map((s) => s.position)];
  map.legs.forEach((leg, i) => {
    const a = pts[i], b = pts[i + 1];
    if (!a || !b) return;
    if (distance(a, ll(leg.line[0])) > 10 || distance(b, ll(leg.line[leg.line.length - 1])) > 10) {
      leg.line = [[a.lat, a.lon], [b.lat, b.lon]];
      leg.routed = false;
    }
  });
  return changed;
}
